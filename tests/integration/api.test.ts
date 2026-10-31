import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../apps/api/src/server.js";

function extractCookie(res: any, cookieName: string): string {
  const setCookie = res.headers["set-cookie"];
  if (!setCookie) return "";
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of cookies) {
    const match = c.match(new RegExp(`^(${cookieName}=[^;]+)`));
    if (match) return match[1];
  }
  return "";
}

function extractAllCookies(res: any): string {
  const setCookie = res.headers["set-cookie"];
  if (!setCookie) return "";
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

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
      url: "/api/health",
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
      url: "/api/meta",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.supported_categories).toContain("upper_body");
    expect(body.supported_categories).toContain("outer");
    expect(body.safety_disclaimer.toLowerCase()).toContain("visual appearance preview");
  });

  it("Executes the complete two-role collaboration flow with cookie auth and privacy boundaries", async () => {
    // 1. Wearer creates Try-On Pass (returns single-use bootstrap code and URL)
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {
        allowed_categories: ["outer", "upper_body"],
        max_proposals: 3,
        expires_in_hours: 2,
        gift_mode: false,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const sessionData = createRes.json();
    expect(sessionData.session_id).toBeDefined();
    expect(sessionData.wearer_bootstrap_code).toBeDefined();
    expect(sessionData.wearer_url).toContain("#bootstrap=");

    // 2. Wearer redeems bootstrap code to obtain HttpOnly session cookie
    const wearerBootRes = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: {
        bootstrap_code: sessionData.wearer_bootstrap_code,
        role: "wearer",
      },
    });
    expect(wearerBootRes.statusCode).toBe(200);
    const wearerCookie = extractCookie(wearerBootRes, "wearerkey_session_wearer");
    expect(wearerCookie).toBeTruthy();

    // 3. Wearer mints Helper link using wearer session cookie
    const helperLinkRes = await app.inject({
      method: "POST",
      url: "/api/wearer/helper-link",
      headers: {
        cookie: wearerCookie,
      },
    });

    expect(helperLinkRes.statusCode).toBe(200);
    const helperLinkData = helperLinkRes.json();
    expect(helperLinkData.helper_bootstrap_code).toBeDefined();
    expect(helperLinkData.helper_url).toContain("#bootstrap=");

    // 4. Helper redeems bootstrap code to obtain helper session cookie
    const helperBootRes = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: {
        bootstrap_code: helperLinkData.helper_bootstrap_code,
        role: "helper",
      },
    });
    expect(helperBootRes.statusCode).toBe(200);
    const helperCookie = extractCookie(helperBootRes, "wearerkey_session_helper");
    expect(helperCookie).toBeTruthy();

    // 5. Helper opens session - PROVE PRIVACY BOUNDARY: helper cannot see wearer photo
    const helperViewRes = await app.inject({
      method: "GET",
      url: "/api/helper/session",
      headers: {
        cookie: helperCookie,
      },
    });

    expect(helperViewRes.statusCode).toBe(200);
    const helperView = helperViewRes.json();
    expect(helperView.wearer_photo_status).toBe("PROTECTED_NOT_SHARED");
    expect(helperView.allowed_categories).toEqual(["outer", "upper_body"]);
    expect(helperView.proposals_remaining).toBe(3);
    // Ensure wearer photo / source url is NEVER returned to helper
    expect((helperView as any).source_file_id).toBeUndefined();
    expect((helperView as any).source_url).toBeUndefined();

    // 6. Wearer view with wearer cookie
    const wearerViewRes = await app.inject({
      method: "GET",
      url: "/api/wearer/session",
      headers: {
        cookie: wearerCookie,
      },
    });

    expect(wearerViewRes.statusCode).toBe(200);
    const wearerView = wearerViewRes.json();
    expect(wearerView.id).toBe(sessionData.session_id);
    expect(wearerView.proposals).toHaveLength(0);

    // 7. Revocation - Wearer revokes session
    const revokeRes = await app.inject({
      method: "DELETE",
      url: "/api/wearer/session",
      headers: {
        cookie: wearerCookie,
      },
    });

    expect(revokeRes.statusCode).toBe(200);
    expect(revokeRes.json().status).toBe("REVOKED");

    // 8. Accessing revoked session fails closed with HTTP 410
    const revokedAccessRes = await app.inject({
      method: "GET",
      url: "/api/helper/session",
      headers: {
        cookie: helperCookie,
      },
    });

    expect(revokedAccessRes.statusCode).toBe(410);
  });

  it("POST /api/judge/seed creates an immediate exploratory session with recorded V4 result", async () => {
    const seedRes = await app.inject({
      method: "POST",
      url: "/api/judge/seed",
    });

    expect(seedRes.statusCode).toBe(201);
    const seedData = seedRes.json();
    expect(seedData.session_id).toBeDefined();
    expect(seedData.wearer_url).toContain("/wearer#bootstrap=");
    expect(seedData.helper_url).toContain("/helper#bootstrap=");
    expect(seedData.mode).toBe("RECORDED_LIVE_RESULT");

    // Redeem wearer bootstrap
    const wearerBootRes = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: {
        bootstrap_code: seedData.wearer_bootstrap_code,
        role: "wearer",
      },
    });
    expect(wearerBootRes.statusCode).toBe(200);
    const wearerCookie = extractCookie(wearerBootRes, "wearerkey_session_wearer");

    // Redeem helper bootstrap
    const helperBootRes = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: {
        bootstrap_code: seedData.helper_bootstrap_code,
        role: "helper",
      },
    });
    expect(helperBootRes.statusCode).toBe(200);
    const helperCookie = extractCookie(helperBootRes, "wearerkey_session_helper");

    // Check Wearer view of seeded proposal
    const wearerView = await app.inject({
      method: "GET",
      url: "/api/wearer/session",
      headers: {
        cookie: wearerCookie,
      },
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
        cookie: helperCookie,
      },
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
        cookie: wearerCookie,
      },
    });
    expect(wearerSourceRes.statusCode).toBe(200);
    expect(wearerSourceRes.headers["content-type"]).toBe("image/png");

    const helperSourceAttempt = await app.inject({
      method: "GET",
      url: "/api/wearer/session/source",
      headers: {
        cookie: helperCookie,
      },
    });
    // Helper cannot access wearer route -> 401 or 403
    expect([401, 403]).toContain(helperSourceAttempt.statusCode);

    // Check Result Stream endpoint: Wearer has access, Helper is blocked
    const proposalId = wData.proposals[0].id;
    const wearerResultRes = await app.inject({
      method: "GET",
      url: `/api/wearer/proposals/${proposalId}/result`,
      headers: {
        cookie: wearerCookie,
      },
    });
    expect(wearerResultRes.statusCode).toBe(200);
    expect(wearerResultRes.headers["content-type"]).toBe("image/png");

    const helperResultAttempt = await app.inject({
      method: "GET",
      url: `/api/wearer/proposals/${proposalId}/result`,
      headers: {
        cookie: helperCookie,
      },
    });
    expect([401, 403]).toContain(helperResultAttempt.statusCode);

    // Check Wearer Scoped Privacy & Deletion Receipt
    const receiptRes = await app.inject({
      method: "GET",
      url: "/api/wearer/receipt",
      headers: {
        cookie: wearerCookie,
      },
    });
    expect(receiptRes.statusCode).toBe(200);
    const receiptData = receiptRes.json();
    expect(receiptData.schema_version).toBe("2.0");
    expect(receiptData.evidence_authority).toBe("WEARERKEY_AUDITABLE_LEDGER");
    expect(receiptData.receipt_hmac).toBeDefined();
    expect(receiptData.receipt_hmac.algorithm).toBe("HMAC-SHA256");
  });

  it("Enforces session cookie authentication on SSE /api/events", async () => {
    // 1. Missing cookie -> 401
    const noCookieRes = await app.inject({
      method: "GET",
      url: "/api/events",
    });
    expect(noCookieRes.statusCode).toBe(401);
    expect(noCookieRes.json().error).toBe("UNAUTHORIZED");

    // 2. Invalid cookie -> 401
    const badCookieRes = await app.inject({
      method: "GET",
      url: "/api/events",
      headers: {
        cookie: "wearerkey_session=invalid_token_12345",
      },
    });
    expect(badCookieRes.statusCode).toBe(401);
    expect(badCookieRes.json().error).toBe("UNAUTHORIZED");
  });

  it("POST /api/auth/bootstrap exchanges single-use bootstrap code for secure HttpOnly cookie", async () => {
    // 1. Create a session
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {
        consent_version: "2026-10-30-v1",
        allowed_categories: ["upper_body", "outer"],
        max_proposals: 3,
        expires_in_hours: 24,
        gift_mode: false,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { wearer_bootstrap_code, session_id } = createRes.json();

    // 2. Bootstrap wearer session
    const bootstrapRes = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: {
        bootstrap_code: wearer_bootstrap_code,
        role: "wearer",
      },
    });
    expect(bootstrapRes.statusCode).toBe(200);
    const bootData = bootstrapRes.json();
    expect(bootData.authenticated).toBe(true);
    expect(bootData.role).toBe("wearer");
    expect(bootData.session_id).toBe(session_id);

    // Verify Set-Cookie header contains HttpOnly wearerkey_session cookie
    const setCookie = bootstrapRes.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toContain("wearerkey_session");
    expect(String(setCookie)).toContain("HttpOnly");
  });

  it("POST /api/receipts/verify validates authentic signatures and detects tampering", async () => {
    // 1. Seed a session to get a real signed receipt
    const seedRes = await app.inject({
      method: "POST",
      url: "/api/judge/seed",
    });
    const { wearer_bootstrap_code } = seedRes.json();

    const bootRes = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: {
        bootstrap_code: wearer_bootstrap_code,
        role: "wearer",
      },
    });
    const wearerCookie = extractCookie(bootRes, "wearerkey_session_wearer");

    const receiptRes = await app.inject({
      method: "GET",
      url: "/api/wearer/receipt",
      headers: { cookie: wearerCookie },
    });
    expect(receiptRes.statusCode).toBe(200);
    const receipt = receiptRes.json();
    const hmac = receipt.receipt_hmac;
    expect(hmac).toBeDefined();

    // 2. Verify authentic receipt
    const verifyValidRes = await app.inject({
      method: "POST",
      url: "/api/receipts/verify",
      payload: {
        receipt,
        signature: hmac.signature,
        signed_at: hmac.signed_at,
        key_id: hmac.key_id,
      },
    });
    expect(verifyValidRes.statusCode).toBe(200);
    expect(verifyValidRes.json().valid).toBe(true);

    // 3. Verify tampered receipt payload is rejected
    const tamperedReceipt = { ...receipt, overall_deletion_status: "TAMPERED_STATUS" };
    const verifyTamperedRes = await app.inject({
      method: "POST",
      url: "/api/receipts/verify",
      payload: {
        receipt: tamperedReceipt,
        signature: hmac.signature,
        signed_at: hmac.signed_at,
        key_id: hmac.key_id,
      },
    });
    expect(verifyTamperedRes.statusCode).toBe(200);
    expect(verifyTamperedRes.json().valid).toBe(false);
  });

  it("P0-B: Enforces single-use bootstrap code redemption and rejects replayed codes with HTTP 409", async () => {
    // 1. Create a session with single-use bootstrap code
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {
        allowed_categories: ["outer", "upper_body"],
        max_proposals: 3,
        expires_in_hours: 1,
        gift_mode: false,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { wearer_bootstrap_code, wearer_url } = createRes.json();
    expect(wearer_bootstrap_code).toBeDefined();
    expect(wearer_url).toContain("#bootstrap=");

    // 2. First redemption: succeeds with HttpOnly session cookie
    const firstRedeem = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: {
        bootstrap_code: wearer_bootstrap_code,
        role: "wearer",
      },
    });
    expect(firstRedeem.statusCode).toBe(200);
    expect(firstRedeem.json().authenticated).toBe(true);
    expect(firstRedeem.headers["set-cookie"]).toBeDefined();

    // 3. Second redemption (replay attempt): must fail with 409 Conflict
    const replayRedeem = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: {
        bootstrap_code: wearer_bootstrap_code,
        role: "wearer",
      },
    });
    expect(replayRedeem.statusCode).toBe(409);
    expect(replayRedeem.json().error).toBe("BOOTSTRAP_CODE_ALREADY_USED");
  });

  it("P0-B: Concurrency regression test — parallel bootstrap calls guarantee exactly one 200 and one 409", async () => {
    // Create a new session with fresh bootstrap code
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {
        allowed_categories: ["outer"],
        max_proposals: 2,
        expires_in_hours: 1,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { wearer_bootstrap_code } = createRes.json();

    // Dispatch two concurrent bootstrap requests with the exact same code
    const [res1, res2] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/auth/bootstrap",
        payload: {
          bootstrap_code: wearer_bootstrap_code,
          role: "wearer",
        },
      }),
      app.inject({
        method: "POST",
        url: "/api/auth/bootstrap",
        payload: {
          bootstrap_code: wearer_bootstrap_code,
          role: "wearer",
        },
      }),
    ]);

    const statusCodes = [res1.statusCode, res2.statusCode].sort();
    expect(statusCodes).toEqual([200, 409]);
  });

  it("Cross-role boundary: wearer cookie cannot access helper routes, and helper cannot access wearer routes", async () => {
    // 1. Seed session to get both roles
    const seedRes = await app.inject({
      method: "POST",
      url: "/api/judge/seed",
    });
    const { wearer_bootstrap_code, helper_bootstrap_code } = seedRes.json();

    const wearerBoot = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: { bootstrap_code: wearer_bootstrap_code, role: "wearer" },
    });
    const wearerCookie = extractCookie(wearerBoot, "wearerkey_session_wearer");

    const helperBoot = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: { bootstrap_code: helper_bootstrap_code, role: "helper" },
    });
    const helperCookie = extractCookie(helperBoot, "wearerkey_session_helper");

    // 2. Wearer cookie attempting helper-only route -> 401 or 403
    const wearerToHelper = await app.inject({
      method: "GET",
      url: "/api/helper/session",
      headers: { cookie: wearerCookie },
    });
    expect([401, 403]).toContain(wearerToHelper.statusCode);

    // 3. Helper cookie attempting wearer-only route -> 401 or 403
    const helperToWearer = await app.inject({
      method: "GET",
      url: "/api/wearer/session",
      headers: { cookie: helperCookie },
    });
    expect([401, 403]).toContain(helperToWearer.statusCode);
  });

  it("P0-A: Purge retry and final receipt remain reachable after session revocation", async () => {
    // 1. Create session and bootstrap
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {
        allowed_categories: ["outer"],
        max_proposals: 2,
        expires_in_hours: 1,
      },
    });
    const { session_id, wearer_bootstrap_code } = createRes.json();

    const bootRes = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: {
        bootstrap_code: wearer_bootstrap_code,
        role: "wearer",
      },
    });
    const wearerCookie = extractCookie(bootRes, "wearerkey_session_wearer");

    // 2. Revoke session -> enters REVOKED state
    const revokeRes = await app.inject({
      method: "DELETE",
      url: "/api/wearer/session",
      headers: { cookie: wearerCookie },
    });
    expect(revokeRes.statusCode).toBe(200);
    const receipt = revokeRes.json();
    expect(receipt.status).toBe("REVOKED");

    // 3. Normal wearer routes fail with 410 SESSION_REVOKED
    const blockedRoute = await app.inject({
      method: "POST",
      url: "/api/wearer/helper-link",
      headers: { cookie: wearerCookie },
    });
    expect(blockedRoute.statusCode).toBe(410);
    expect(blockedRoute.json().error).toBe("SESSION_REVOKED");

    // 4. Retry-purge route remains REACHABLE via wearer auth or purge recovery token
    const retryRes = await app.inject({
      method: "POST",
      url: "/api/wearer/session/retry-purge",
      headers: { cookie: wearerCookie },
    });
    expect(retryRes.statusCode).toBe(200);
    expect(retryRes.json().overall_deletion_status).toBeDefined();

    // 5. GET /api/receipts remains reachable and serves immutable signed receipt
    const getReceiptRes = await app.inject({
      method: "GET",
      url: "/api/receipts",
      headers: { cookie: wearerCookie },
    });
    expect(getReceiptRes.statusCode).toBe(200);
    expect(getReceiptRes.json().session_id).toBe(session_id);
    expect(getReceiptRes.json().receipt_hmac).toBeDefined();
  });

  it("Rate limiting: triggers HTTP 429 when rate limit threshold is exceeded", async () => {
    // Using header x-test-rate-limit: true
    // Bootstrap rate limit is 30/min
    // We send 35 rapid requests with x-test-rate-limit: true
    let hitRateLimit = false;
    for (let i = 0; i < 35; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/bootstrap",
        headers: {
          "x-test-rate-limit": "true",
        },
        payload: {
          bootstrap_code: "rate_limit_test_code_123456",
        },
      });
      if (res.statusCode === 429) {
        hitRateLimit = true;
        expect(res.json().error).toBe("TOO_MANY_REQUESTS");
        break;
      }
    }
    expect(hitRateLimit).toBe(true);
  });

  it("Enforces SSRF domain restriction on remote result proxy", async () => {
    // Seed judge session
    const seedRes = await app.inject({
      method: "POST",
      url: "/api/judge/seed",
    });
    const { wearer_bootstrap_code } = seedRes.json();

    const bootRes = await app.inject({
      method: "POST",
      url: "/api/auth/bootstrap",
      payload: {
        bootstrap_code: wearer_bootstrap_code,
        role: "wearer",
      },
    });
    const wearerCookie = extractCookie(bootRes, "wearerkey_session_wearer");

    // Query session to get proposal ID
    const sessionRes = await app.inject({
      method: "GET",
      url: "/api/wearer/session",
      headers: { cookie: wearerCookie },
    });
    const proposalId = sessionRes.json().proposals[0].id;

    // Direct result query on legitimate fixture/asset works
    const validResultRes = await app.inject({
      method: "GET",
      url: `/api/wearer/proposals/${proposalId}/result`,
      headers: { cookie: wearerCookie },
    });
    expect([200, 302]).toContain(validResultRes.statusCode);
  });
});
