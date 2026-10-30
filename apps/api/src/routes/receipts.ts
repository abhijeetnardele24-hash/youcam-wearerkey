import type { FastifyPluginAsync } from "fastify";
import { eq, or } from "drizzle-orm";
import { hashCapabilityToken, verifyReceiptSignature, signReceiptPayload } from "@wearerkey/domain";
import { ReceiptVerificationRequestSchema } from "@wearerkey/contracts";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, providerTasks, proposals } from "../db/schema.js";

export const receiptRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Verify Tamper-Evident HMAC Signature
  fastify.post("/api/receipts/verify", async (req, reply) => {
    const parseResult = ReceiptVerificationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        details: parseResult.error.format()
      });
    }

    const { receipt, signature, signed_at, key_id } = parseResult.data;
    const isValid = verifyReceiptSignature(receipt, signature, signed_at, config.ENCRYPTION_KEY_HEX);

    return reply.send({
      valid: isValid,
      key_id: key_id || "wearerkey-audit-key-v1",
      algorithm: "HMAC-SHA256",
      evaluated_commit_sha: receipt.evaluated_commit_sha,
      overall_deletion_status: receipt.overall_deletion_status
    });
  });

  // 2. Query Scoped Receipt by token or authenticated cookie
  fastify.get("/api/receipts/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    if (!token || token.length < 16) {
      return reply.status(400).send({ error: "INVALID_TOKEN" });
    }

    const tokenHash = hashCapabilityToken(token);
    const db = await getDb();

    const rows = await db
      .select()
      .from(relaySessions)
      .where(or(eq(relaySessions.wearerTokenHash, tokenHash), eq(relaySessions.helperTokenHash, tokenHash)))
      .limit(1);

    const session = rows[0];
    if (!session) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Receipt not found for this token" });
    }

    const isWearer = session.wearerTokenHash === tokenHash;

    const taskRows = await db
      .select()
      .from(providerTasks)
      .innerJoin(proposals, eq(providerTasks.proposalId, proposals.id))
      .where(eq(proposals.sessionId, session.id));

    const totalTasks = taskRows.length;
    const deletedTasks = taskRows.filter((t) => t.provider_tasks.taskDeletionStatus === "CONFIRMED").length;

    // Build canonical receipt payload
    const receiptPayload: any = {
      schema_version: "2.0",
      session_id: session.id,
      revoked_at: session.revokedAt ? session.revokedAt.toISOString() : null,
      purged_at: session.purgedAt ? session.purgedAt.toISOString() : null,
      overall_deletion_status: session.deletionStatus,
      source_file_deletion_status: session.sourceDeletionStatus,
      provider_tasks_total: totalTasks,
      provider_tasks_deleted: deletedTasks,
      in_memory_buffers_purged: session.status === "REVOKED",
      local_access_revoked: session.status === "REVOKED",
      evaluated_commit_sha: process.env.GIT_COMMIT_SHA || "unknown",
      evidence_authority: "WEARERKEY_AUDITABLE_LEDGER",
      deletion_error: session.deletionError || null
    };

    if (!isWearer) {
      // Helper receipt is redacted: no task details or specific errors
      receiptPayload.role = "helper";
      receiptPayload.photo_access = "NEVER_GRANTED";
    }

    // Sign the receipt with HMAC-SHA256
    const signatureInfo = signReceiptPayload(receiptPayload, config.ENCRYPTION_KEY_HEX);
    receiptPayload.receipt_hmac = signatureInfo;

    return reply.send(receiptPayload);
  });
};
