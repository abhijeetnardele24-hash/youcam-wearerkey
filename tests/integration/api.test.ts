import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../apps/api/src/server.js";

describe("WearerKey End-to-End API Integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health returns HTTP 200 with truthful metadata", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.app).toBe("WearerKey API");
    expect(body.provider_mode).toBeDefined();
    expect(body.commit).toBeDefined();
  });

  it("GET /api/meta returns supported categories and safety disclaimer", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/meta"
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.supported_categories).toContain("upper_body");
    expect(body.supported_categories).toContain("outer");
    expect(body.safety_disclaimer.toLowerCase()).toContain("visual appearance preview");
  });

  it("Executes the complete two-role collaboration flow and enforces privacy boundaries", async () => {
    // 1. Wearer creates Try-On Pass
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {
        allowed_categories: ["outer", "upper_body"],
        max_proposals: 3,
        expires_in_hours: 2,
        gift_mode: false
      }
    });

    if (createRes.statusCode !== 201) {
      console.error("CREATE SESSION FAILED:", createRes.statusCode, createRes.payload);
    }
    expect(createRes.statusCode).toBe(201);
    const sessionData = createRes.json();
    expect(sessionData.session_id).toBeDefined();
    expect(sessionData.wearer_token).toBeDefined();
    const wearerToken = sessionData.wearer_token;

    // 2. Wearer mints Helper link
    const helperLinkRes = await app.inject({
      method: "POST",
      url: "/api/wearer/helper-link",
      headers: {
        Authorization: `Bearer ${wearerToken}`
      }
    });

    expect(helperLinkRes.statusCode).toBe(200);
    const helperToken = helperLinkRes.json().helper_token;
    expect(helperToken).toBeDefined();
    expect(helperToken).not.toBe(wearerToken);

    // 3. Helper opens session - PROVE PRIVACY BOUNDARY: helper cannot see wearer photo
    const helperViewRes = await app.inject({
      method: "GET",
      url: "/api/helper/session",
      headers: {
        Authorization: `Bearer ${helperToken}`
      }
    });

    expect(helperViewRes.statusCode).toBe(200);
    const helperView = helperViewRes.json();
    expect(helperView.wearer_photo_status).toBe("PROTECTED_NOT_SHARED");
    expect(helperView.allowed_categories).toEqual(["outer", "upper_body"]);
    expect(helperView.proposals_remaining).toBe(3);
    // Ensure wearer photo / source url is NEVER returned to helper
    expect((helperView as any).source_file_id).toBeUndefined();
    expect((helperView as any).source_url).toBeUndefined();

    // 4. Wearer view
    const wearerViewRes = await app.inject({
      method: "GET",
      url: "/api/wearer/session",
      headers: {
        Authorization: `Bearer ${wearerToken}`
      }
    });

    expect(wearerViewRes.statusCode).toBe(200);
    const wearerView = wearerViewRes.json();
    expect(wearerView.id).toBe(sessionData.session_id);
    expect(wearerView.proposals).toHaveLength(0);

    // 5. Revocation - Wearer revokes session
    const revokeRes = await app.inject({
      method: "DELETE",
      url: "/api/wearer/session",
      headers: {
        Authorization: `Bearer ${wearerToken}`
      }
    });

    expect(revokeRes.statusCode).toBe(200);
    expect(revokeRes.json().status).toBe("REVOKED");

    // 6. Accessing revoked session fails closed with HTTP 410
    const revokedAccessRes = await app.inject({
      method: "GET",
      url: "/api/helper/session",
      headers: {
        Authorization: `Bearer ${helperToken}`
      }
    });

    expect(revokedAccessRes.statusCode).toBe(410);
  });

  it("POST /api/judge/seed creates an immediate exploratory session with recorded V4 result", async () => {
    const seedRes = await app.inject({
      method: "POST",
      url: "/api/judge/seed"
    });

    expect(seedRes.statusCode).toBe(201);
    const seedData = seedRes.json();
    expect(seedData.session_id).toBeDefined();
    expect(seedData.wearer_url).toContain("/wearer/");
    expect(seedData.helper_url).toContain("/helper/");
    expect(seedData.mode).toBe("RECORDED_LIVE_RESULT");

    // Check Wearer view of seeded proposal
    const wearerView = await app.inject({
      method: "GET",
      url: "/api/wearer/session",
      headers: {
        Authorization: `Bearer ${seedData.wearer_token}`
      }
    });

    expect(wearerView.statusCode).toBe(200);
    const wData = wearerView.json();
    expect(wData.proposals).toHaveLength(1);
    expect(wData.proposals[0].label).toBe("Tailored Camel Wool Overcoat");
    expect(wData.proposals[0].decision).toBe("MAYBE");
    expect(wData.proposals[0].has_result).toBe(true);
    expect(wData.proposals[0].result_stream_url).toContain("/result");

    // Check Helper view of seeded proposal: gets label and decision, but NO result URL!
    const helperView = await app.inject({
      method: "GET",
      url: "/api/helper/session",
      headers: {
        Authorization: `Bearer ${seedData.helper_token}`
      }
    });

    expect(helperView.statusCode).toBe(200);
    const hData = helperView.json();
    expect(hData.proposals).toHaveLength(1);
    expect(hData.proposals[0].label).toBe("Tailored Camel Wool Overcoat");
    expect(hData.proposals[0].decision).toBe("MAYBE");
    expect(hData.proposals[0].wearer_note).toContain("drape and cut look great");
    expect(hData.proposals[0].result_stream_url).toBeUndefined();
    expect(hData.proposals[0].result_url).toBeUndefined();

    // Check Wearer Source Photo endpoint: Wearer has access, Helper is blocked
    const wearerSourceRes = await app.inject({
      method: "GET",
      url: "/api/wearer/session/source",
      headers: {
        Authorization: `Bearer ${seedData.wearer_token}`
      }
    });
    expect(wearerSourceRes.statusCode).toBe(200);
    expect(wearerSourceRes.headers["content-type"]).toBe("image/png");

    const helperSourceAttempt = await app.inject({
      method: "GET",
      url: "/api/wearer/session/source",
      headers: {
        Authorization: `Bearer ${seedData.helper_token}`
      }
    });
    expect(helperSourceAttempt.statusCode).toBe(403);

    // Check Result Stream endpoint: Wearer has access, Helper is blocked
    const proposalId = wData.proposals[0].id;
    const wearerResultRes = await app.inject({
      method: "GET",
      url: `/api/wearer/proposals/${proposalId}/result`,
      headers: {
        Authorization: `Bearer ${seedData.wearer_token}`
      }
    });
    expect(wearerResultRes.statusCode).toBe(200);
    expect(wearerResultRes.headers["content-type"]).toBe("image/png");

    const helperResultAttempt = await app.inject({
      method: "GET",
      url: `/api/wearer/proposals/${proposalId}/result`,
      headers: {
        Authorization: `Bearer ${seedData.helper_token}`
      }
    });
    expect(helperResultAttempt.statusCode).toBe(403);

    // Check Wearer Scoped Privacy & Deletion Receipt
    const receiptRes = await app.inject({
      method: "GET",
      url: "/api/wearer/receipt",
      headers: {
        Authorization: `Bearer ${seedData.wearer_token}`
      }
    });
    expect(receiptRes.statusCode).toBe(200);
    const receiptData = receiptRes.json();
    expect(receiptData.schema_version).toBe("1.0");
    expect(receiptData.evidence_authority).toBe("WEARERKEY_AUDITABLE_LEDGER");
  });

  it("Enforces capability authorization on SSE /api/events", async () => {
    // 1. Missing token -> 401
    const noTokenRes = await app.inject({
      method: "GET",
      url: "/api/events"
    });
    expect(noTokenRes.statusCode).toBe(401);
    expect(noTokenRes.json().error).toBe("UNAUTHORIZED");

    // 2. Invalid token -> 401
    const badTokenRes = await app.inject({
      method: "GET",
      url: "/api/events?token=totally_invalid_token_12345"
    });
    expect(badTokenRes.statusCode).toBe(401);
    expect(badTokenRes.json().error).toBe("UNAUTHORIZED");
  });
});
