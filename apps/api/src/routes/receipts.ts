import type { FastifyPluginAsync } from "fastify";
import { eq, or } from "drizzle-orm";
import { hashCapabilityToken, verifyReceiptSignature, signReceiptPayload } from "@wearerkey/domain";
import { ReceiptVerificationRequestSchema } from "@wearerkey/contracts";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, providerTasks, proposals } from "../db/schema.js";
import { requirePurgeRecoveryAuth } from "../middleware/auth.js";

export const receiptRoutes: FastifyPluginAsync = async (fastify) => {
  const signingKey = config.RECEIPT_SIGNING_KEY || config.ENCRYPTION_KEY_HEX;

  // 1. Verify Tamper-Evident HMAC Signature
  fastify.post("/api/receipts/verify", async (req, reply) => {
    const parseResult = ReceiptVerificationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        details: parseResult.error.format()
      });
    }

    const { receipt, key_id } = parseResult.data;
    const signature = parseResult.data.signature || receipt?.receipt_hmac?.signature;
    const signed_at = parseResult.data.signed_at || receipt?.receipt_hmac?.signed_at;

    if (!signature || !signed_at) {
      return reply.status(400).send({
        error: "MISSING_SIGNATURE",
        message: "Receipt signature and signed_at timestamp are required for cryptographic verification."
      });
    }

    const isValid = verifyReceiptSignature(receipt, signature, signed_at, signingKey);

    return reply.send({
      valid: isValid,
      key_id: key_id || receipt?.receipt_hmac?.key_id || "wearerkey-audit-key-v1",
      algorithm: "HMAC-SHA256",
      evaluated_commit_sha: receipt.evaluated_commit_sha,
      overall_deletion_status: receipt.overall_deletion_status
    });
  });

  // 2. Query Scoped Receipt via Authenticated Session / Purge Recovery (P0-C: No tokens in URL)
  fastify.get(
    "/api/receipts",
    { preHandler: [requirePurgeRecoveryAuth] },
    async (req, reply) => {
      const auth = req.authSession!;
      const session = auth.session;

      // If an immutable signed receipt was already persisted, return it directly
      if (session.signedReceiptJson) {
        try {
          const parsed = JSON.parse(session.signedReceiptJson);
          return reply.send(parsed);
        } catch {
          // fall through to regenerate
        }
      }

      const db = await getDb();
      const taskRows = await db
        .select()
        .from(providerTasks)
        .innerJoin(proposals, eq(providerTasks.proposalId, proposals.id))
        .where(eq(proposals.sessionId, session.id));

      const totalTasks = taskRows.length;
      const deletedTasks = taskRows.filter((t) => t.provider_tasks.taskDeletionStatus === "CONFIRMED").length;
      const failedTasks = taskRows.filter((t) => t.provider_tasks.taskDeletionStatus === "FAILED").length;

      const propRows = await db
        .select()
        .from(proposals)
        .where(eq(proposals.sessionId, session.id));

      const garmentFiles = propRows.filter((p) => !!p.garmentFileIdCiphertext);
      const garmentDeleted = propRows.filter((p) => p.garmentDeletionStatus === "CONFIRMED").length;

      const totalFiles = (session.sourceFileIdCiphertext ? 1 : 0) + garmentFiles.length;
      const deletedFiles = (session.sourceDeletionStatus === "CONFIRMED" ? 1 : 0) + garmentDeleted;

      const taskStatus =
        totalTasks === 0 ? "NOT_REQUESTED" : failedTasks > 0 ? (deletedTasks > 0 ? "PARTIAL_FAILURE" : "FAILED") : "CONFIRMED";
      const garmentStatus =
        garmentFiles.length === 0 ? "NOT_REQUESTED" : garmentDeleted === garmentFiles.length ? "CONFIRMED" : "PARTIAL_FAILURE";

      const receiptPayload: any = {
        schema_version: "2.0",
        session_id: session.id,
        status: session.status,
        revoked_at: session.revokedAt ? session.revokedAt.toISOString() : null,
        purged_at: session.purgedAt ? session.purgedAt.toISOString() : null,
        overall_deletion_status: session.deletionStatus,
        task_deletion_status: taskStatus,
        source_file_deletion_status: session.sourceDeletionStatus,
        garment_file_deletion_status: garmentStatus,
        provider_tasks_total: totalTasks,
        provider_tasks_deleted: deletedTasks,
        remote_files_total: totalFiles,
        remote_files_deleted: deletedFiles,
        in_memory_buffers_purged: session.status === "REVOKED",
        local_access_revoked: session.status === "REVOKED",
        evaluated_commit_sha: process.env.GIT_COMMIT_SHA || "unknown",
        evidence_authority: "WEARERKEY_AUDITABLE_LEDGER",
        deletion_error: session.deletionError || null,
        ...(session.deletionErrors ? { deletion_errors: session.deletionErrors } : {})
      };

      const signatureInfo = signReceiptPayload(receiptPayload, signingKey);
      receiptPayload.receipt_hmac = signatureInfo;

      return reply.send(receiptPayload);
    }
  );

  // 3. Query Scoped Receipt by token (Backward compatibility)
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
      .where(
        or(
          eq(relaySessions.wearerTokenHash, tokenHash),
          eq(relaySessions.helperTokenHash, tokenHash),
          eq(relaySessions.wearerSessionTokenHash, tokenHash),
          eq(relaySessions.helperSessionTokenHash, tokenHash),
          eq(relaySessions.purgeRecoveryTokenHash, tokenHash)
        )
      )
      .limit(1);

    const session = rows[0];
    if (!session) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Receipt not found for this token" });
    }

    if (session.signedReceiptJson) {
      try {
        const parsed = JSON.parse(session.signedReceiptJson);
        return reply.send(parsed);
      } catch {
        // fall through
      }
    }

    const isWearer =
      session.wearerTokenHash === tokenHash ||
      session.wearerSessionTokenHash === tokenHash ||
      session.purgeRecoveryTokenHash === tokenHash;

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
      evidence_authority: "WEARERKEY_APPLICATION_SIGNED_ASSERTION",
      deletion_error: session.deletionError || null
    };

    if (!isWearer) {
      // Helper receipt is redacted: no task details or specific errors
      receiptPayload.role = "helper";
      receiptPayload.photo_access = "NEVER_GRANTED";
    }

    // Sign the receipt with HMAC-SHA256
    const signatureInfo = signReceiptPayload(receiptPayload, signingKey);
    receiptPayload.receipt_hmac = signatureInfo;

    return reply.send(receiptPayload);
  });
};

