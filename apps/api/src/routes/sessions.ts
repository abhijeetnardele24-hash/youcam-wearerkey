import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import {
  generateBootstrapCode,
  hashBootstrapCode,
  generatePurgeRecoveryToken,
  hashPurgeRecoveryToken,
  encryptProviderIdentifier,
  decryptProviderIdentifier,
  signReceiptPayload
} from "@wearerkey/domain";
import {
  CreateSessionRequestSchema,
  type DeletionStatus,
  type StructuredDeletionError
} from "@wearerkey/contracts";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, providerTasks, proposals, auditEvents } from "../db/schema.js";
import { requireRole, requirePurgeRecoveryAuth } from "../middleware/auth.js";
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
    const wearerBootstrapCode = generateBootstrapCode();
    const helperBootstrapCode = generateBootstrapCode();

    const wearerBootstrapCodeHash = hashBootstrapCode(wearerBootstrapCode);
    const helperBootstrapCodeHash = hashBootstrapCode(helperBootstrapCode);

    const expiresAt = new Date(Date.now() + input.expires_in_hours * 3600 * 1000);
    const db = await getDb();

    const inserted = await db
      .insert(relaySessions)
      .values({
        status: "DRAFT",
        wearerBootstrapCodeHash,
        helperBootstrapCodeHash,
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
      wearer_bootstrap_code: wearerBootstrapCode,
      wearer_url: `${config.APP_BASE_URL}/wearer#bootstrap=${wearerBootstrapCode}`,
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
          error: "MISSING_FILE",
          message: "A photographic reference image file is required."
        });
      }

      const buffer = await data.toBuffer();
      let sanitized;
      try {
        sanitized = await sanitizeAndValidateImage(buffer);
      } catch (err: any) {
        return reply.status(400).send({
          error: "INVALID_IMAGE",
          code: err.code || "VALIDATION_FAILED",
          message: err.message
        });
      }

      // Store in memory for ephemeral preview
      ephemeralImageStore.saveSource(auth.sessionId, sanitized.buffer, sanitized.mimeType);

      // Upload to provider using official S2S File API protocol
      const provider = getProvider();
      const uploadedFile = await provider.uploadImage(sanitized, "source");

      const encKey = config.PROVIDER_ID_ENCRYPTION_KEY || config.ENCRYPTION_KEY_HEX;
      const encryptedFileId = encryptProviderIdentifier(uploadedFile.fileId, encKey);
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

      // Generate single-use bootstrap code for helper
      const helperBootstrapCode = generateBootstrapCode();
      const helperBootstrapCodeHash = hashBootstrapCode(helperBootstrapCode);

      await db
        .update(relaySessions)
        .set({
          helperBootstrapCodeHash,
          helperBootstrapRedeemedAt: null,
          updatedAt: new Date()
        })
        .where(eq(relaySessions.id, auth.sessionId));

      const hostHeader = req.headers["x-forwarded-host"] || req.headers.host;
      const protoHeader = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const baseOrigin = req.headers.origin || (hostHeader ? `${protoHeader}://${hostHeader}` : config.APP_BASE_URL);

      return reply.send({
        helper_bootstrap_code: helperBootstrapCode,
        helper_url: `${baseOrigin}/helper#bootstrap=${helperBootstrapCode}`,
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

    // Track resource categories separately for accurate resource accounting
    let tasksTotal = 0;
    let tasksDeleted = 0;
    let tasksFailed = 0;

    let garmentsTotal = 0;
    let garmentsDeleted = 0;
    let garmentsFailed = 0;

    let sourcesTotal = 0;
    let sourcesDeleted = 0;
    let sourcesFailed = 0;

    const errors: string[] = [];
    const structuredErrors: StructuredDeletionError[] = [];
    const encKey = config.PROVIDER_ID_ENCRYPTION_KEY || config.ENCRYPTION_KEY_HEX;

    // 1. Delete remote provider tasks
    for (const prop of sessionProposals) {
      const tasks = await db
        .select()
        .from(providerTasks)
        .where(eq(providerTasks.proposalId, prop.id));

      for (const t of tasks) {
        if (!t.taskIdCiphertext) continue;
        tasksTotal++;

        if (onlyRetryFailed && t.taskDeletionStatus === "CONFIRMED") {
          tasksDeleted++;
          continue;
        }

        const now = new Date();
        await db
          .update(providerTasks)
          .set({ taskDeletionStatus: "REQUESTED", deletionRequestedAt: now })
          .where(eq(providerTasks.id, t.id));

        try {
          const remoteTaskId = decryptProviderIdentifier(t.taskIdCiphertext, encKey);
          const res = await provider.deleteTask(remoteTaskId);
          if (res.confirmed) {
            tasksDeleted++;
            await db
              .update(providerTasks)
              .set({ taskDeletionStatus: "CONFIRMED", deletionConfirmedAt: new Date() })
              .where(eq(providerTasks.id, t.id));
          } else {
            tasksFailed++;
            await db
              .update(providerTasks)
              .set({ taskDeletionStatus: "FAILED" })
              .where(eq(providerTasks.id, t.id));
            const msg = `Task ${t.id} deletion unconfirmed by provider`;
            errors.push(msg);
            structuredErrors.push({
              resource_type: "TASK",
              resource_id: t.id,
              error: msg,
              timestamp: new Date().toISOString()
            });
          }
        } catch (err: any) {
          tasksFailed++;
          await db
            .update(providerTasks)
            .set({ taskDeletionStatus: "FAILED" })
            .where(eq(providerTasks.id, t.id));
          const msg = `Task ${t.id} deletion error: ${err.message}`;
          errors.push(msg);
          structuredErrors.push({
            resource_type: "TASK",
            resource_id: t.id,
            error: msg,
            timestamp: new Date().toISOString()
          });
        }
      }

      // 2. Delete remote garment file
      if (prop.garmentFileIdCiphertext) {
        garmentsTotal++;
        if (onlyRetryFailed && prop.garmentDeletionStatus === "CONFIRMED") {
          garmentsDeleted++;
        } else {
          try {
            const remoteGarmentId = decryptProviderIdentifier(prop.garmentFileIdCiphertext, encKey);
            const ok = await provider.deleteFile(remoteGarmentId);
            if (ok) {
              garmentsDeleted++;
              await db
                .update(proposals)
                .set({ garmentDeletionStatus: "CONFIRMED" })
                .where(eq(proposals.id, prop.id));
            } else {
              garmentsFailed++;
              await db
                .update(proposals)
                .set({ garmentDeletionStatus: "FAILED" })
                .where(eq(proposals.id, prop.id));
              const msg = `Garment file for proposal ${prop.id} deletion failed`;
              errors.push(msg);
              structuredErrors.push({
                resource_type: "GARMENT_FILE",
                resource_id: prop.id,
                error: msg,
                timestamp: new Date().toISOString()
              });
            }
          } catch (err: any) {
            garmentsFailed++;
            await db
              .update(proposals)
              .set({ garmentDeletionStatus: "FAILED" })
              .where(eq(proposals.id, prop.id));
            const msg = `Garment file error: ${err.message}`;
            errors.push(msg);
            structuredErrors.push({
              resource_type: "GARMENT_FILE",
              resource_id: prop.id,
              error: msg,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    // 3. Delete remote source file
    if (session.sourceFileIdCiphertext) {
      sourcesTotal++;
      if (onlyRetryFailed && session.sourceDeletionStatus === "CONFIRMED") {
        sourcesDeleted++;
      } else {
        try {
          const remoteSourceId = decryptProviderIdentifier(session.sourceFileIdCiphertext, encKey);
          const ok = await provider.deleteFile(remoteSourceId);
          if (ok) {
            sourcesDeleted++;
            await db
              .update(relaySessions)
              .set({ sourceDeletionStatus: "CONFIRMED" })
              .where(eq(relaySessions.id, sessionId));
          } else {
            sourcesFailed++;
            await db
              .update(relaySessions)
              .set({ sourceDeletionStatus: "FAILED" })
              .where(eq(relaySessions.id, sessionId));
            const msg = "Source file deletion failed";
            errors.push(msg);
            structuredErrors.push({
              resource_type: "SOURCE_FILE",
              resource_id: sessionId,
              error: msg,
              timestamp: new Date().toISOString()
            });
          }
        } catch (err: any) {
          sourcesFailed++;
          await db
            .update(relaySessions)
            .set({ sourceDeletionStatus: "FAILED" })
            .where(eq(relaySessions.id, sessionId));
          const msg = `Source file deletion error: ${err.message}`;
          errors.push(msg);
          structuredErrors.push({
            resource_type: "SOURCE_FILE",
            resource_id: sessionId,
            error: msg,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // 4. Purge all ephemeral in-memory preview buffers
    ephemeralImageStore.purgeSession(sessionId, proposalIds);

    // Exact resource-level deletion status calculation
    const taskStatus: DeletionStatus =
      tasksTotal === 0
        ? "NOT_REQUESTED"
        : tasksFailed === 0
          ? "CONFIRMED"
          : tasksDeleted === 0
            ? "FAILED"
            : "PARTIAL_FAILURE";

    const garmentStatus: DeletionStatus =
      garmentsTotal === 0
        ? "NOT_REQUESTED"
        : garmentsFailed === 0
          ? "CONFIRMED"
          : garmentsDeleted === 0
            ? "FAILED"
            : "PARTIAL_FAILURE";

    const sourceStatus: DeletionStatus =
      sourcesTotal === 0
        ? "NOT_REQUESTED"
        : sourcesFailed === 0
          ? "CONFIRMED"
          : "FAILED";

    const _totalRequested = tasksTotal + garmentsTotal + sourcesTotal;
    const anyFailed = tasksFailed > 0 || garmentsFailed > 0 || sourcesFailed > 0;
    const anySucceeded = tasksDeleted > 0 || garmentsDeleted > 0 || sourcesDeleted > 0;

    const overallStatus: DeletionStatus =
      anyFailed
        ? (anySucceeded ? "PARTIAL_FAILURE" : "FAILED")
        : "CONFIRMED";

    const now = new Date();
    // CRITICAL SECURITY INVARIANT: purgedAt MUST remain null if any deletion is unconfirmed or failed
    const purgedAt = anyFailed ? null : now;
    const deletionError = errors.length > 0 ? errors.join("; ") : null;
    const revokedAt = session.revokedAt || now;

    // Purge recovery token: mint strictly when deletions fail or remain partial
    let purgeRecoveryToken: string | null = null;
    let purgeRecoveryTokenHash: string | null = null;
    let purgeRecoveryExpiresAt: Date | null = null;

    if (anyFailed) {
      purgeRecoveryToken = generatePurgeRecoveryToken();
      purgeRecoveryTokenHash = hashPurgeRecoveryToken(purgeRecoveryToken);
      purgeRecoveryExpiresAt = new Date(Date.now() + 3600 * 1000); // 1-hour window aligned with cookie maxAge
    }

    // Versioned receipt tracking
    const existingVersions: any[] = (session.versionedReceiptsJson as any[]) || [];
    const receiptVersion = existingVersions.length + 1;

    // Label deletion verification truthfully
    const deletionVerificationMode =
      provider.mode === "LIVE_YOUCAM"
        ? (anyFailed ? "NOT_LIVE_VERIFIED" : "GENUINE_PROVIDER_CONFIRMED")
        : "SIMULATED";

    const receiptPayload: any = {
      schema_version: "2.0",
      receipt_version: receiptVersion,
      is_final: overallStatus === "CONFIRMED",
      session_id: sessionId,
      status: "REVOKED",
      revoked_at: revokedAt.toISOString(),
      purged_at: purgedAt ? purgedAt.toISOString() : null,
      overall_deletion_status: overallStatus,
      task_deletion_status: taskStatus,
      source_file_deletion_status: sourceStatus,
      garment_file_deletion_status: garmentStatus,
      provider_tasks_total: tasksTotal,
      provider_tasks_deleted: tasksDeleted,
      remote_files_total: garmentsTotal + sourcesTotal,
      remote_files_deleted: garmentsDeleted + sourcesDeleted,
      in_memory_buffers_purged: true,
      local_access_revoked: true,
      deletion_verification_mode: deletionVerificationMode,
      evaluated_commit_sha: process.env.GIT_COMMIT_SHA || "unknown",
      evidence_authority: "WEARERKEY_APPLICATION_SIGNED_ASSERTION",
      deletion_error: deletionError,
      ...(structuredErrors.length > 0 ? { deletion_errors: structuredErrors } : {})
    };

    const signingKey = config.RECEIPT_SIGNING_KEY || config.ENCRYPTION_KEY_HEX;
    const signatureInfo = signReceiptPayload(receiptPayload, signingKey);
    receiptPayload.receipt_hmac = signatureInfo;

    const updatedVersions = [...existingVersions, receiptPayload];

    // Atomically invalidate active session credentials while retaining revoked hashes for 410 detection & recovery
    const revokedWearerHash = session.wearerSessionTokenHash || session.revokedWearerSessionTokenHash;
    const revokedHelperHash = session.helperSessionTokenHash || session.revokedHelperSessionTokenHash;

    await db
      .update(relaySessions)
      .set({
        status: "REVOKED",
        revokedAt,
        purgedAt,
        deletionStatus: overallStatus,
        sourceDeletionStatus: sourceStatus,
        deletionError,
        deletionErrors: structuredErrors.length > 0 ? structuredErrors : null,
        wearerSessionTokenHash: null,
        helperSessionTokenHash: null,
        revokedWearerSessionTokenHash: revokedWearerHash,
        revokedHelperSessionTokenHash: revokedHelperHash,
        purgeRecoveryTokenHash,
        purgeRecoveryExpiresAt,
        signedReceiptJson: JSON.stringify(receiptPayload),
        versionedReceiptsJson: updatedVersions,
        updatedAt: now
      })
      .where(eq(relaySessions.id, sessionId));

    return { receipt: receiptPayload, purgeRecoveryToken, overallStatus };
  }

  // 4. Revoke Try-On Pass (Wearer Only)
  fastify.delete(
    "/api/wearer/session",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const db = await getDb();

      const { receipt, purgeRecoveryToken } = await executePurge(auth.sessionId, false);

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


      // If partial failure occurred, issue dedicated Secure HttpOnly purge-recovery cookie
      if (purgeRecoveryToken) {
        reply.setCookie("wearerkey_purge_recovery", purgeRecoveryToken, {
          path: "/",
          httpOnly: true,
          secure: config.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 3600 // 1 hour
        });
      }

      return reply.send(receipt);
    }
  );

  // 5. Retry Purge on Partial Deletion Failure (Protected by Purge Recovery Authorization)
  fastify.post(
    "/api/wearer/session/retry-purge",
    { preHandler: [requirePurgeRecoveryAuth] },
    async (req, reply) => {
      const auth = req.authSession!;
      const db = await getDb();

      const { receipt, purgeRecoveryToken, overallStatus } = await executePurge(auth.sessionId, true);

      await db.insert(auditEvents).values({
        sessionId: auth.sessionId,
        actorRole: "wearer",
        eventType: "SESSION_PURGE_RETRIED",
        details: {
          overall_deletion_status: receipt.overall_deletion_status,
          purged_at: receipt.purged_at,
          receipt_version: receipt.receipt_version
        }
      });

      // If purge confirmed, clear the recovery cookie
      if (overallStatus === "CONFIRMED") {
        reply.clearCookie("wearerkey_purge_recovery", { path: "/" });
      } else if (purgeRecoveryToken) {
        reply.setCookie("wearerkey_purge_recovery", purgeRecoveryToken, {
          path: "/",
          httpOnly: true,
          secure: config.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 3600
        });
      }

      return reply.send(receipt);
    }
  );
};
