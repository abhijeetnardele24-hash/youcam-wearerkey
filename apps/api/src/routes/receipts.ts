import type { FastifyPluginAsync } from "fastify";
import { verifyReceiptSignature } from "@wearerkey/domain";
import { ReceiptVerificationRequestSchema } from "@wearerkey/contracts";
import { config } from "../config.js";
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

  // 2. Query Scoped Receipt via Authenticated Session / Purge Recovery (No tokens in URL)
  fastify.get(
    "/api/receipts",
    { preHandler: [requirePurgeRecoveryAuth] },
    async (req, reply) => {
      const auth = req.authSession!;
      const session = auth.session;

      // Handle all-versions query
      const query = req.query as { all_versions?: string; version?: string };
      if (query?.all_versions === "true") {
        const versions = (session.versionedReceiptsJson as any[]) || [];
        return reply.send({
          session_id: session.id,
          total_versions: versions.length,
          receipts: versions
        });
      }

      // If specific version requested
      if (query?.version) {
        const targetVer = parseInt(query.version, 10);
        const versions = (session.versionedReceiptsJson as any[]) || [];
        const found = versions.find((r) => r.receipt_version === targetVer);
        if (!found) {
          return reply.status(404).send({
            error: "RECEIPT_VERSION_NOT_FOUND",
            message: `Receipt version ${targetVer} not found for this session.`
          });
        }
        return reply.send(found);
      }

      // Return the authoritative persisted latest signed receipt
      if (!session.signedReceiptJson) {
        return reply.status(404).send({
          error: "RECEIPT_NOT_FOUND",
          message: "No deletion receipt has been generated for this session yet. Session must be revoked or purged first."
        });
      }

      try {
        const parsed = JSON.parse(session.signedReceiptJson);
        return reply.send(parsed);
      } catch {
        // Strict integrity: fail closed rather than silently regenerating corrupted data
        return reply.status(500).send({
          error: "RECEIPT_INTEGRITY_ERROR",
          message: "Persisted receipt record is malformed."
        });
      }
    }
  );
};
