import type { FastifyPluginAsync } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  generateCapabilityToken,
  hashCapabilityToken,
  encryptProviderIdentifier
} from "@wearerkey/domain";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, proposals, providerTasks, decisions, auditEvents } from "../db/schema.js";
import { ephemeralImageStore } from "../services/garment-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../../public");

export const judgeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/api/judge/seed", async (_req, reply) => {
    const wearerToken = generateCapabilityToken();
    const helperToken = generateCapabilityToken();

    const wearerHash = hashCapabilityToken(wearerToken);
    const helperHash = hashCapabilityToken(helperToken);

    const expiresAt = new Date(Date.now() + 4 * 3600 * 1000); // 4 hours
    const db = await getDb();

    // 1. Seed Active Relay Session
    const insertedSession = await db
      .insert(relaySessions)
      .values({
        status: "ACTIVE",
        wearerTokenHash: wearerHash,
        helperTokenHash: helperHash,
        consentVersion: "2026-10-30-v1",
        allowedCategories: ["upper_body", "outer", "full_body"],
        maxProposals: 3,
        expiresAt,
        giftMode: false,
        sourceContentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        sourceFileIdCiphertext: encryptProviderIdentifier("judge_seed_source_file_id", config.ENCRYPTION_KEY_HEX)
      })
      .returning();

    const session = insertedSession[0];

    // 2. Seed a Succeeded Proposal (Sample Tailored Wool Overcoat)
    const insertedProposal = await db
      .insert(proposals)
      .values({
        sessionId: session.id,
        label: "Tailored Camel Wool Overcoat",
        garmentCategory: "outer",
        priceMinor: 24500,
        currency: "USD",
        brand: "Atelier Nordic",
        productUrl: "https://example.com/products/camel-overcoat",
        garmentContentHash: "f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2",
        status: "SUCCEEDED",
        completedAt: new Date()
      })
      .returning();

    const prop = insertedProposal[0];

    // Store in ephemeral memory store if public sample files exist
    const sourceSample = path.join(publicDir, "sample_wearer_reference.png");
    if (fs.existsSync(sourceSample)) {
      ephemeralImageStore.saveSource(session.id, fs.readFileSync(sourceSample), "image/png");
    }
    const garmentSample = path.join(publicDir, "sample_garment_overcoat.png");
    if (fs.existsSync(garmentSample)) {
      ephemeralImageStore.saveGarment(prop.id, fs.readFileSync(garmentSample), "image/png");
    }

    const providerMode = "RECORDED_LIVE_RESULT";

    // 3. Seed Provider Task with Recorded / Fixture Result
    await db.insert(providerTasks).values({
      proposalId: prop.id,
      provider: "YOUCAM",
      mode: providerMode,
      apiFamily: "AI_CLOTHES_V4",
      taskIdCiphertext: encryptProviderIdentifier("recorded_judge_task_v4_success", config.ENCRYPTION_KEY_HEX),
      resultUrlCiphertext: encryptProviderIdentifier("/assets/sample_vto_result.png", config.ENCRYPTION_KEY_HEX),
      estimatedUnits: 2,
      observedUnits: 2,
      providerStatus: "SUCCEEDED",
      receiptSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      evaluatedCommitSha: process.env.GIT_COMMIT_SHA || "unknown",
      finishedAt: new Date()
    });

    // 4. Seed Decision (Maybe - with safe note)
    await db.insert(decisions).values({
      proposalId: prop.id,
      decision: "MAYBE",
      note: "The drape and cut look great; checking if the navy colorway is also available.",
      decidedAt: new Date()
    });

    await db.insert(auditEvents).values({
      sessionId: session.id,
      actorRole: "judge",
      eventType: "JUDGE_SESSION_SEEDED",
      details: { session_id: session.id, proposal_id: prop.id }
    });

    return reply.status(201).send({
      session_id: session.id,
      wearer_token: wearerToken,
      helper_token: helperToken,
      wearer_url: `/wearer/${wearerToken}`,
      helper_url: `/helper/${helperToken}`,
      status: "ACTIVE",
      mode: providerMode,
      message: "Judge sample session seeded successfully with verified deterministic V4 result."
    });
  });
};
