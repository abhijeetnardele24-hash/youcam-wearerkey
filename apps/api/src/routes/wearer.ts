import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { SubmitDecisionRequestSchema } from "@wearerkey/contracts";
import { decryptProviderIdentifier } from "@wearerkey/domain";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, proposals, providerTasks, decisions, auditEvents } from "../db/schema.js";
import { requireRole } from "../middleware/auth.js";
import { eventBus } from "../services/event-bus.js";
import { request } from "undici";

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
        helper_link_minted: true,
        created_at: s.createdAt.toISOString(),
        proposals: proposalDTOs
      });
    }
  );

  // 2. Private Result Image Stream Proxy (Wearer Only)
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

      // If it's a relative URL or local asset
      if (rawResultUrl.startsWith("/")) {
        return reply.redirect(rawResultUrl);
      }

      // Stream from YouCam CDN directly to wearer browser
      const streamRes = await request(rawResultUrl, { method: "GET" });
      reply.header("Content-Type", streamRes.headers["content-type"] || "image/jpeg");
      reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
      return reply.send(streamRes.body);
    }
  );

  // 3. Wearer Records Decision (Approve / Maybe / Pass)
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

  // 4. Wearer Scoped Privacy & Deletion Receipt
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

      return reply.send({
        schema_version: "1.0",
        session_id: auth.sessionId,
        status: auth.session.status,
        revoked_at: auth.session.revokedAt ? auth.session.revokedAt.toISOString() : null,
        purged_at: auth.session.purgedAt ? auth.session.purgedAt.toISOString() : null,
        provider_tasks_total: taskRows.length,
        local_access_revoked: auth.session.status === "REVOKED",
        evaluated_commit_sha: process.env.GIT_COMMIT_SHA || "unknown",
        evidence_authority: "WEARERKEY_AUDITABLE_LEDGER"
      });
    }
  );
};
