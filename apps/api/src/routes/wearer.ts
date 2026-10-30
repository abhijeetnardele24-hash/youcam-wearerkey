import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { SubmitDecisionRequestSchema, type DeletionStatus } from "@wearerkey/contracts";
import { decryptProviderIdentifier, signReceiptPayload } from "@wearerkey/domain";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, proposals, providerTasks, decisions, auditEvents } from "../db/schema.js";
import { requireRole } from "../middleware/auth.js";
import { eventBus } from "../services/event-bus.js";
import { ephemeralImageStore } from "../services/garment-store.js";
import { request } from "undici";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../../public");

export const wearerRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Wearer Room Dashboard State
  fastify.get(
    "/api/wearer/session",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const db = await getDb();

      // Query session and proposals
      const propRows = await db
        .select()
        .from(proposals)
        .where(eq(proposals.sessionId, auth.sessionId));

      const proposalDTOs = [];
      for (const p of propRows) {
        const decRows = await db
          .select()
          .from(decisions)
          .where(eq(decisions.proposalId, p.id))
          .limit(1);

        const taskRows = await db
          .select()
          .from(providerTasks)
          .where(eq(providerTasks.proposalId, p.id))
          .limit(1);

        const task = taskRows[0];
        const hasResult = !!(task && task.providerStatus === "SUCCEEDED" && task.resultUrlCiphertext);

        proposalDTOs.push({
          id: p.id,
          label: p.label,
          garment_category: p.garmentCategory as any,
          price_minor: p.priceMinor,
          currency: p.currency,
          product_url: p.productUrl,
          brand: p.brand,
          status: p.status as any,
          decision: decRows[0]?.decision as any,
          wearer_note: decRows[0]?.note,
          has_result: hasResult,
          result_stream_url: hasResult ? `/api/wearer/proposals/${p.id}/result` : null,
          garment_preview_url: `/api/wearer/proposals/${p.id}/garment`,
          failure_code: p.failureCode,
          failure_message_safe: p.failureMessageSafe,
          created_at: p.createdAt.toISOString(),
          completed_at: p.completedAt ? p.completedAt.toISOString() : null
        });
      }

      const s = auth.session;
      return reply.send({
        id: s.id,
        status: s.status,
        consent_version: s.consentVersion,
        allowed_categories: s.allowedCategories,
        max_proposals: s.maxProposals,
        proposals_count: proposalDTOs.length,
        proposals_remaining: Math.max(0, s.maxProposals - proposalDTOs.length),
        expires_at: s.expiresAt.toISOString(),
        gift_mode: s.giftMode,
        source_uploaded: !!s.sourceContentHash,
        source_image_url: s.sourceContentHash ? "/api/wearer/session/source" : null,
        helper_link_minted: true,
        created_at: s.createdAt.toISOString(),
        proposals: proposalDTOs
      });
    }
  );

  // 2. Wearer Source Photo Stream (Wearer Only - Private)
  fastify.get(
    "/api/wearer/session/source",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const stored = ephemeralImageStore.getSource(auth.sessionId);
      if (stored) {
        reply.header("Content-Type", stored.mimeType);
        reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
        return reply.send(stored.buffer);
      }
      const fallbackPath = path.resolve(publicDir, "sample_wearer_reference.png");
      if (fs.existsSync(fallbackPath)) {
        reply.header("Content-Type", "image/png");
        reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
        return reply.send(fs.readFileSync(fallbackPath));
      }
      return reply.status(404).send({ error: "NOT_FOUND", message: "Source image not found" });
    }
  );

  // 3. Garment Preview Stream (Wearer Only)
  fastify.get(
    "/api/wearer/proposals/:id/garment",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const { id } = req.params as { id: string };
      const db = await getDb();
      const pRows = await db
        .select()
        .from(proposals)
        .where(eq(proposals.id, id))
        .limit(1);

      if (!pRows[0] || pRows[0].sessionId !== auth.sessionId) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Proposal not found" });
      }

      const stored = ephemeralImageStore.getGarment(id);
      if (stored) {
        reply.header("Content-Type", stored.mimeType);
        reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
        return reply.send(stored.buffer);
      }
      const fallbackPath = path.resolve(publicDir, "sample_garment_overcoat.png");
      if (fs.existsSync(fallbackPath)) {
        reply.header("Content-Type", "image/png");
        reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
        return reply.send(fs.readFileSync(fallbackPath));
      }
      return reply.status(404).send({ error: "NOT_FOUND", message: "Garment image not found" });
    }
  );

  // 4. Private Result Image Stream Proxy (Wearer Only)
  fastify.get(
    "/api/wearer/proposals/:id/result",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const { id } = req.params as { id: string };
      const db = await getDb();

      const pRows = await db
        .select()
        .from(proposals)
        .where(eq(proposals.id, id))
        .limit(1);

      if (!pRows[0] || pRows[0].sessionId !== auth.sessionId) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Proposal not found" });
      }

      const taskRows = await db
        .select()
        .from(providerTasks)
        .where(eq(providerTasks.proposalId, id))
        .limit(1);

      const task = taskRows[0];
      if (!task || !task.resultUrlCiphertext) {
        return reply.status(404).send({ error: "NO_RESULT", message: "No try-on result available" });
      }

      const rawResultUrl = decryptProviderIdentifier(task.resultUrlCiphertext, config.ENCRYPTION_KEY_HEX);
      const fallbackPath = path.resolve(publicDir, "sample_vto_result.png");

      // If it's a relative URL, local asset, or fake mock URL
      if (
        rawResultUrl.startsWith("/") ||
        rawResultUrl.includes("fake.youcam.local") ||
        rawResultUrl.includes("sample_vto_result")
      ) {
        if (fs.existsSync(fallbackPath)) {
          reply.header("Content-Type", "image/png");
          reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
          return reply.send(fs.readFileSync(fallbackPath));
        }
        return reply.redirect(rawResultUrl.startsWith("/") ? rawResultUrl : "/assets/sample_vto_result.png");
      }

      // Stream from YouCam CDN directly to wearer browser
      try {
        const streamRes = await request(rawResultUrl, { method: "GET" });
        if (streamRes.statusCode >= 200 && streamRes.statusCode < 300) {
          reply.header("Content-Type", streamRes.headers["content-type"] || "image/jpeg");
          reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
          return reply.send(streamRes.body);
        }
        // Non-200 from remote CDN -> fallback to sample
        if (fs.existsSync(fallbackPath)) {
          reply.header("Content-Type", "image/png");
          reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
          return reply.send(fs.readFileSync(fallbackPath));
        }
        return reply.status(streamRes.statusCode).send({ error: "UPSTREAM_CDN_ERROR" });
      } catch (err) {
        req.log.warn({ err }, "Failed to fetch remote result, falling back to local asset");
        if (fs.existsSync(fallbackPath)) {
          reply.header("Content-Type", "image/png");
          reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
          return reply.send(fs.readFileSync(fallbackPath));
        }
        return reply.status(502).send({ error: "REMOTE_FETCH_FAILED" });
      }
    }
  );

  // 5. Wearer Records Decision (Approve / Maybe / Pass)
  fastify.post(
    "/api/wearer/proposals/:id/decision",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const { id } = req.params as { id: string };

      const parseResult = SubmitDecisionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "INVALID_REQUEST",
          details: parseResult.error.format()
        });
      }

      const { decision, note } = parseResult.data;
      const db = await getDb();

      const pRows = await db
        .select()
        .from(proposals)
        .where(eq(proposals.id, id))
        .limit(1);

      if (!pRows[0] || pRows[0].sessionId !== auth.sessionId) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Proposal not found" });
      }

      // Upsert decision
      await db
        .insert(decisions)
        .values({
          proposalId: id,
          decision,
          note: note ? note.trim().slice(0, 140) : null,
          decidedAt: new Date()
        })
        .onConflictDoUpdate({
          target: decisions.proposalId,
          set: {
            decision,
            note: note ? note.trim().slice(0, 140) : null,
            decidedAt: new Date()
          }
        });

      await db
        .update(proposals)
        .set({ status: "REVIEWED" })
        .where(eq(proposals.id, id));

      await db.insert(auditEvents).values({
        sessionId: auth.sessionId,
        actorRole: "wearer",
        eventType: "DECISION_RECORDED",
        details: { proposal_id: id, decision, has_note: !!note }
      });

      // Notify helper
      eventBus.publish({
        sessionId: auth.sessionId,
        type: "DECISION_RECORDED",
        targetRole: "helper",
        payload: {
          proposal_id: id,
          decision,
          wearer_note: note || null
        }
      });

      return reply.send({
        proposal_id: id,
        decision,
        note: note || null,
        decided_at: new Date().toISOString()
      });
    }
  );

  // 6. Wearer Scoped Privacy & Deletion Receipt (Signed Tamper-Evident Receipt v2.0)
  fastify.get(
    "/api/wearer/receipt",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const db = await getDb();

      const taskRows = await db
        .select()
        .from(providerTasks)
        .innerJoin(proposals, eq(providerTasks.proposalId, proposals.id))
        .where(eq(proposals.sessionId, auth.sessionId));

      const totalTasks = taskRows.length;
      const deletedTasks = taskRows.filter((t) => t.provider_tasks.taskDeletionStatus === "CONFIRMED").length;
      const failedTasks = taskRows.filter((t) => t.provider_tasks.taskDeletionStatus === "FAILED").length;

      const propRows = await db
        .select()
        .from(proposals)
        .where(eq(proposals.sessionId, auth.sessionId));

      const garmentFiles = propRows.filter((p) => !!p.garmentFileIdCiphertext);
      const garmentDeleted = propRows.filter((p) => p.garmentDeletionStatus === "CONFIRMED").length;

      const totalFiles = (auth.session.sourceFileIdCiphertext ? 1 : 0) + garmentFiles.length;
      const deletedFiles = (auth.session.sourceDeletionStatus === "CONFIRMED" ? 1 : 0) + garmentDeleted;

      const taskStatus: DeletionStatus =
        totalTasks === 0 ? "NOT_REQUESTED" : failedTasks > 0 ? (deletedTasks > 0 ? "PARTIAL_FAILURE" : "FAILED") : "CONFIRMED";
      const garmentStatus: DeletionStatus =
        garmentFiles.length === 0 ? "NOT_REQUESTED" : garmentDeleted === garmentFiles.length ? "CONFIRMED" : "PARTIAL_FAILURE";

      const receiptPayload: any = {
        schema_version: "2.0",
        session_id: auth.sessionId,
        revoked_at: auth.session.revokedAt ? auth.session.revokedAt.toISOString() : null,
        purged_at: auth.session.purgedAt ? auth.session.purgedAt.toISOString() : null,
        overall_deletion_status: auth.session.deletionStatus,
        task_deletion_status: taskStatus,
        source_file_deletion_status: auth.session.sourceDeletionStatus,
        garment_file_deletion_status: garmentStatus,
        provider_tasks_total: totalTasks,
        provider_tasks_deleted: deletedTasks,
        remote_files_total: totalFiles,
        remote_files_deleted: deletedFiles,
        in_memory_buffers_purged: auth.session.status === "REVOKED",
        local_access_revoked: auth.session.status === "REVOKED",
        evaluated_commit_sha: process.env.GIT_COMMIT_SHA || "unknown",
        evidence_authority: "WEARERKEY_AUDITABLE_LEDGER",
        deletion_error: auth.session.deletionError || null
      };

      const signatureInfo = signReceiptPayload(receiptPayload, config.ENCRYPTION_KEY_HEX);
      receiptPayload.receipt_hmac = signatureInfo;

      return reply.send(receiptPayload);
    }
  );
};
