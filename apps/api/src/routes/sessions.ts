import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import {
  generateCapabilityToken,
  hashCapabilityToken,
  encryptProviderIdentifier,
  decryptProviderIdentifier,
  signReceiptPayload
} from "@wearerkey/domain";
import { CreateSessionRequestSchema, type DeletionStatus } from "@wearerkey/contracts";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, providerTasks, proposals, auditEvents } from "../db/schema.js";
import { requireRole } from "../middleware/auth.js";
import { sanitizeAndValidateImage } from "../services/image-sanitizer.js";
import { getProvider } from "../providers/youcam/index.js";
import { eventBus } from "../services/event-bus.js";
import { ephemeralImageStore } from "../services/garment-store.js";

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Create a Try-On Pass (Public)
  fastify.post("/api/sessions", async (req, reply) => {
    const parseResult = CreateSessionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        details: parseResult.error.format()
      });
    }

    const input = parseResult.data;
    const wearerToken = generateCapabilityToken();
    const helperToken = generateCapabilityToken();

    const wearerHash = hashCapabilityToken(wearerToken);
    const helperHash = hashCapabilityToken(helperToken);

    const expiresAt = new Date(Date.now() + input.expires_in_hours * 3600 * 1000);
    const db = await getDb();

    const inserted = await db
      .insert(relaySessions)
      .values({
        status: "DRAFT",
        wearerTokenHash: wearerHash,
        helperTokenHash: helperHash,
        consentVersion: input.consent_version,
        allowedCategories: input.allowed_categories,
        maxProposals: input.max_proposals,
        expiresAt,
        giftMode: input.gift_mode
      })
      .returning();

    const session = inserted[0];

    // Audit event
    await db.insert(auditEvents).values({
      sessionId: session.id,
      actorRole: "wearer",
      eventType: "SESSION_CREATED",
      details: {
        allowed_categories: input.allowed_categories,
        max_proposals: input.max_proposals,
        expires_at: expiresAt.toISOString(),
        gift_mode: input.gift_mode
      }
    });

    return reply.status(201).send({
      session_id: session.id,
      wearer_token: wearerToken,
      wearer_url: `${config.APP_BASE_URL}/wearer/${wearerToken}`,
      expires_at: expiresAt.toISOString(),
      status: session.status
    });
  });

  // 2. Wearer Uploads Source Photo
  fastify.put(
    "/api/wearer/session",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const data = await req.file();

      if (!data) {
        return reply.status(400).send({
          error: "MISSING_IMAGE",
          message: "Please provide a valid source photo."
        });
      }

      const buffer = await data.toBuffer();
      let sanitized;
      try {
        sanitized = await sanitizeAndValidateImage(buffer);
      } catch (err: any) {
        return reply.status(400).send({
          error: err.code || "IMAGE_VALIDATION_ERROR",
          message: err.message
        });
      }

      // Store in ephemeral memory store for private preview by wearer only
      ephemeralImageStore.saveSource(auth.sessionId, sanitized.buffer, sanitized.mimeType);

      const provider = getProvider();
      let uploadedFile;
      try {
        uploadedFile = await provider.uploadImage(sanitized, "source");
      } catch (err: any) {
        req.log.error({ err }, "YouCam File API source upload failed");
        return reply.status(502).send({
          error: "PROVIDER_UPLOAD_ERROR",
          message: "Failed to upload photo to virtual try-on engine. Please try again."
        });
      }

      const encryptedFileId = encryptProviderIdentifier(uploadedFile.fileId, config.ENCRYPTION_KEY_HEX);
      const db = await getDb();

      await db
        .update(relaySessions)
        .set({
          status: "ACTIVE",
          sourceFileIdCiphertext: encryptedFileId,
          sourceContentHash: sanitized.contentHash,
          updatedAt: new Date()
        })
        .where(eq(relaySessions.id, auth.sessionId));

      await db.insert(auditEvents).values({
        sessionId: auth.sessionId,
        actorRole: "wearer",
        eventType: "SOURCE_PHOTO_UPLOADED",
        details: {
          content_hash: sanitized.contentHash,
          dimensions: `${sanitized.width}x${sanitized.height}`,
          byte_size: sanitized.byteSize
        }
      });

      eventBus.publish({
        sessionId: auth.sessionId,
        type: "SOURCE_UPLOADED",
        targetRole: "all",
        payload: { ready: true }
      });

      return reply.send({
        status: "ACTIVE",
        source_uploaded: true,
        content_hash: sanitized.contentHash
      });
    }
  );

  // 3. Mint / Reveal Helper Link (Wearer Only)
  fastify.post(
    "/api/wearer/helper-link",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const db = await getDb();

      // Regenerate fresh helper capability token
      const helperToken = generateCapabilityToken();
      const helperHash = hashCapabilityToken(helperToken);

      await db
        .update(relaySessions)
        .set({
          helperTokenHash: helperHash,
          updatedAt: new Date()
        })
        .where(eq(relaySessions.id, auth.sessionId));

      return reply.send({
        helper_token: helperToken,
        helper_url: `${config.APP_BASE_URL}/helper/${helperToken}`,
        expires_at: auth.session.expiresAt.toISOString()
      });
    }
  );

  // Helper execution function for purge & revocation logic
  async function executePurge(sessionId: string, onlyRetryFailed = false) {
    const db = await getDb();
    const provider = getProvider();

    const sessionRows = await db
      .select()
      .from(relaySessions)
      .where(eq(relaySessions.id, sessionId))
      .limit(1);

    const session = sessionRows[0];
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sessionProposals = await db
      .select()
      .from(proposals)
      .where(eq(proposals.sessionId, sessionId));

    const proposalIds = sessionProposals.map((p) => p.id);

    let totalTasks = 0;
    let deletedTasks = 0;
    let failedTasks = 0;

    let totalFiles = 0;
    let deletedFiles = 0;
    let failedFiles = 0;
    const errors: string[] = [];

    // 1. Delete remote provider tasks
    for (const prop of sessionProposals) {
      const tasks = await db
        .select()
        .from(providerTasks)
        .where(eq(providerTasks.proposalId, prop.id));

      for (const t of tasks) {
        if (!t.taskIdCiphertext) continue;
        totalTasks++;

        if (onlyRetryFailed && t.taskDeletionStatus === "CONFIRMED") {
          deletedTasks++;
          continue;
        }

        const now = new Date();
        await db
          .update(providerTasks)
          .set({ taskDeletionStatus: "REQUESTED", deletionRequestedAt: now })
          .where(eq(providerTasks.id, t.id));

        try {
          const remoteTaskId = decryptProviderIdentifier(t.taskIdCiphertext, config.ENCRYPTION_KEY_HEX);
          const res = await provider.deleteTask(remoteTaskId);
          if (res.confirmed) {
            deletedTasks++;
            await db
              .update(providerTasks)
              .set({ taskDeletionStatus: "CONFIRMED", deletionConfirmedAt: new Date() })
              .where(eq(providerTasks.id, t.id));
          } else {
            failedTasks++;
            await db
              .update(providerTasks)
              .set({ taskDeletionStatus: "FAILED" })
              .where(eq(providerTasks.id, t.id));
            errors.push(`Task ${t.id} deletion unconfirmed by provider`);
          }
        } catch (err: any) {
          failedTasks++;
          await db
            .update(providerTasks)
            .set({ taskDeletionStatus: "FAILED" })
            .where(eq(providerTasks.id, t.id));
          errors.push(`Task ${t.id} deletion error: ${err.message}`);
        }
      }

      // 2. Delete remote garment file
      if (prop.garmentFileIdCiphertext) {
        totalFiles++;
        if (onlyRetryFailed && prop.garmentDeletionStatus === "CONFIRMED") {
          deletedFiles++;
        } else {
          try {
            const remoteGarmentId = decryptProviderIdentifier(prop.garmentFileIdCiphertext, config.ENCRYPTION_KEY_HEX);
            const ok = await provider.deleteFile(remoteGarmentId);
            if (ok) {
              deletedFiles++;
              await db
                .update(proposals)
                .set({ garmentDeletionStatus: "CONFIRMED" })
                .where(eq(proposals.id, prop.id));
            } else {
              failedFiles++;
              await db
                .update(proposals)
                .set({ garmentDeletionStatus: "FAILED" })
                .where(eq(proposals.id, prop.id));
              errors.push(`Garment file for proposal ${prop.id} deletion failed`);
            }
          } catch (err: any) {
            failedFiles++;
            await db
              .update(proposals)
              .set({ garmentDeletionStatus: "FAILED" })
              .where(eq(proposals.id, prop.id));
            errors.push(`Garment file error: ${err.message}`);
          }
        }
      }
    }

    // 3. Delete remote source file
    if (session.sourceFileIdCiphertext) {
      totalFiles++;
      if (onlyRetryFailed && session.sourceDeletionStatus === "CONFIRMED") {
        deletedFiles++;
      } else {
        try {
          const remoteSourceId = decryptProviderIdentifier(session.sourceFileIdCiphertext, config.ENCRYPTION_KEY_HEX);
          const ok = await provider.deleteFile(remoteSourceId);
          if (ok) {
            deletedFiles++;
            await db
              .update(relaySessions)
              .set({ sourceDeletionStatus: "CONFIRMED" })
              .where(eq(relaySessions.id, sessionId));
          } else {
            failedFiles++;
            await db
              .update(relaySessions)
              .set({ sourceDeletionStatus: "FAILED" })
              .where(eq(relaySessions.id, sessionId));
            errors.push("Source file deletion failed");
          }
        } catch (err: any) {
          failedFiles++;
          await db
            .update(relaySessions)
            .set({ sourceDeletionStatus: "FAILED" })
            .where(eq(relaySessions.id, sessionId));
          errors.push(`Source file deletion error: ${err.message}`);
        }
      }
    }

    // 4. Purge all ephemeral in-memory preview buffers
    ephemeralImageStore.purgeSession(sessionId, proposalIds);

    const hasFailures = failedTasks > 0 || failedFiles > 0;
    const overallStatus: DeletionStatus = hasFailures ? "PARTIAL_FAILURE" : "CONFIRMED";
    const taskStatus: DeletionStatus =
      totalTasks === 0 ? "NOT_REQUESTED" : failedTasks > 0 ? (deletedTasks > 0 ? "PARTIAL_FAILURE" : "FAILED") : "CONFIRMED";
    const garmentStatus: DeletionStatus = sessionProposals.some((p) => p.garmentFileIdCiphertext)
      ? failedFiles > 0 ? "PARTIAL_FAILURE" : "CONFIRMED"
      : "NOT_REQUESTED";
    const sourceStatus: DeletionStatus = session.sourceFileIdCiphertext
      ? errors.some((e) => e.includes("Source")) ? "FAILED" : "CONFIRMED"
      : "NOT_REQUESTED";

    const now = new Date();
    // CRITICAL SECURITY INVARIANT: purgedAt MUST remain null if any deletion is unconfirmed or failed
    const purgedAt = hasFailures ? null : now;
    const deletionError = errors.length > 0 ? errors.join("; ") : null;
    const revokedAt = session.revokedAt || now;

    await db
      .update(relaySessions)
      .set({
        status: "REVOKED",
        revokedAt,
        purgedAt,
        deletionStatus: overallStatus,
        sourceDeletionStatus: sourceStatus,
        deletionError,
        updatedAt: now
      })
      .where(eq(relaySessions.id, sessionId));

    const receiptPayload: any = {
      schema_version: "2.0",
      session_id: sessionId,
      status: "REVOKED",
      revoked_at: revokedAt.toISOString(),
      purged_at: purgedAt ? purgedAt.toISOString() : null,
      overall_deletion_status: overallStatus,
      task_deletion_status: taskStatus,
      source_file_deletion_status: sourceStatus,
      garment_file_deletion_status: garmentStatus,
      provider_tasks_total: totalTasks,
      provider_tasks_deleted: deletedTasks,
      remote_files_total: totalFiles,
      remote_files_deleted: deletedFiles,
      in_memory_buffers_purged: true,
      local_access_revoked: true,
      evaluated_commit_sha: process.env.GIT_COMMIT_SHA || "unknown",
      evidence_authority: "WEARERKEY_AUDITABLE_LEDGER",
      deletion_error: deletionError
    };

    const signatureInfo = signReceiptPayload(receiptPayload, config.ENCRYPTION_KEY_HEX);
    receiptPayload.receipt_hmac = signatureInfo;

    return receiptPayload;
  }

  // 4. Revoke Try-On Pass (Wearer Only)
  fastify.delete(
    "/api/wearer/session",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const db = await getDb();

      const receipt = await executePurge(auth.sessionId, false);

      await db.insert(auditEvents).values({
        sessionId: auth.sessionId,
        actorRole: "wearer",
        eventType: "SESSION_REVOKED",
        details: {
          overall_deletion_status: receipt.overall_deletion_status,
          purged_at: receipt.purged_at,
          tasks_deleted: receipt.provider_tasks_deleted,
          files_deleted: receipt.remote_files_deleted
        }
      });

      eventBus.publish({
        sessionId: auth.sessionId,
        type: "SESSION_REVOKED",
        targetRole: "all",
        payload: {
          revoked_at: receipt.revoked_at,
          overall_deletion_status: receipt.overall_deletion_status
        }
      });

      return reply.send(receipt);
    }
  );

  // 5. Retry Purge on Partial Deletion Failure (Wearer Only)
  fastify.post(
    "/api/wearer/session/retry-purge",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const db = await getDb();

      const receipt = await executePurge(auth.sessionId, true);

      await db.insert(auditEvents).values({
        sessionId: auth.sessionId,
        actorRole: "wearer",
        eventType: "SESSION_PURGE_RETRIED",
        details: {
          overall_deletion_status: receipt.overall_deletion_status,
          purged_at: receipt.purged_at
        }
      });

      return reply.send(receipt);
    }
  );
};
