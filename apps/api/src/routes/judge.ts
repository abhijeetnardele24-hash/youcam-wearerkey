import type { FastifyPluginAsync } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import {
  generateBootstrapCode,
  hashBootstrapCode,
  encryptProviderIdentifier,
  signReceiptPayload
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
    const wearerBootstrapCode = generateBootstrapCode();
    const helperBootstrapCode = generateBootstrapCode();

    const wearerBootstrapHash = hashBootstrapCode(wearerBootstrapCode);
    const helperBootstrapHash = hashBootstrapCode(helperBootstrapCode);

    const expiresAt = new Date(Date.now() + 4 * 3600 * 1000); // 4 hours
    const db = await getDb();

    // 1. Seed Active Relay Session
    const insertedSession = await db
      .insert(relaySessions)
      .values({
        status: "ACTIVE",
        wearerBootstrapCodeHash: wearerBootstrapHash,
        helperBootstrapCodeHash: helperBootstrapHash,
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

    // Determine provider mode strictly based on validated recorded-result manifest evidence
    let providerMode: "LIVE_YOUCAM" | "RECORDED_LIVE_RESULT" | "DEMO_FIXTURE" = "DEMO_FIXTURE";
    const manifestPath = path.resolve(__dirname, "../../docs/recorded-result-manifest.json");
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        if (
          manifest.provenance === "CONFIRMED_PROVIDER_EXECUTION" &&
          manifest.result_image_sha256 &&
          manifest.task_id_hash &&
          manifest.evaluated_commit_sha
        ) {
          providerMode = "RECORDED_LIVE_RESULT";
        }
      } catch {
        providerMode = "DEMO_FIXTURE";
      }
    }

    // 3. Seed Provider Task with Truthful Mode (DEMO_FIXTURE unless evidence exists)
    await db.insert(providerTasks).values({
      proposalId: prop.id,
      provider: "YOUCAM",
      mode: providerMode,
      apiFamily: "AI_CLOTHES_V4",
      taskIdCiphertext: encryptProviderIdentifier("judge_fixture_task_v4", config.ENCRYPTION_KEY_HEX),
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

    // 5. Seed Tamper-Evident Signed Deletion & Audit Receipt (v2.0)
    const receiptPayload: any = {
      schema_version: "2.0",
      receipt_version: 1,
      is_final: false,
      session_id: session.id,
      status: "ACTIVE",
      revoked_at: null,
      purged_at: null,
      overall_deletion_status: "NOT_REQUESTED",
      task_deletion_status: "NOT_REQUESTED",
      source_file_deletion_status: "NOT_REQUESTED",
      garment_file_deletion_status: "NOT_REQUESTED",
      provider_tasks_total: 1,
      provider_tasks_deleted: 0,
      remote_files_total: 1,
      remote_files_deleted: 0,
      in_memory_buffers_purged: false,
      local_access_revoked: false,
      deletion_verification_mode: "SIMULATED",
      evaluated_commit_sha: process.env.GIT_COMMIT_SHA || "unknown",
      evidence_authority: "WEARERKEY_AUDITABLE_LEDGER",
      deletion_error: null
    };

    const signingKey = config.RECEIPT_SIGNING_KEY || config.ENCRYPTION_KEY_HEX;
    const signatureInfo = signReceiptPayload(receiptPayload, signingKey);
    receiptPayload.receipt_hmac = signatureInfo;

    await db
      .update(relaySessions)
      .set({
        signedReceiptJson: JSON.stringify(receiptPayload),
        versionedReceiptsJson: [receiptPayload]
      })
      .where(eq(relaySessions.id, session.id));

    await db.insert(auditEvents).values({
      sessionId: session.id,
      actorRole: "judge",
      eventType: "JUDGE_SESSION_SEEDED",
      details: { session_id: session.id, proposal_id: prop.id }
    });

    return reply.status(201).send({
      session_id: session.id,
      wearer_bootstrap_code: wearerBootstrapCode,
      helper_bootstrap_code: helperBootstrapCode,
      wearer_url: `/wearer#bootstrap=${wearerBootstrapCode}`,
      helper_url: `/helper#bootstrap=${helperBootstrapCode}`,
      status: "ACTIVE",
      mode: providerMode,
      message: "Judge sample session seeded successfully with deterministic workflow demonstration of the Clothes V4 integration boundary."
    });
  });
};
