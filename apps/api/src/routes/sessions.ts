import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import {
  generateCapabilityToken,
  hashCapabilityToken,
  encryptProviderIdentifier
} from "@wearerkey/domain";
import { CreateSessionRequestSchema } from "@wearerkey/contracts";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, providerTasks, proposals, auditEvents } from "../db/schema.js";
import { requireRole } from "../middleware/auth.js";
import { sanitizeAndValidateImage } from "../services/image-sanitizer.js";
import { getProvider } from "../providers/youcam/index.js";
import { eventBus } from "../services/event-bus.js";

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

  // 4. Revoke Try-On Pass (Wearer Only)
  fastify.delete(
    "/api/wearer/session",
    { preHandler: [requireRole("wearer")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const db = await getDb();
      const provider = getProvider();

      // Find all tasks for this session
      const sessionProposals = await db
        .select()
        .from(proposals)
        .where(eq(proposals.sessionId, auth.sessionId));

      let deletedCount = 0;
      let totalTasks = 0;

      for (const prop of sessionProposals) {
        const tasks = await db
          .select()
          .from(providerTasks)
          .where(eq(providerTasks.proposalId, prop.id));

        totalTasks += tasks.length;
        for (const t of tasks) {
          if (t.taskIdCiphertext) {
            try {
              // Delete from YouCam
              const res = await provider.deleteTask(t.id);
              if (res.confirmed) {
                deletedCount++;
              }
            } catch (err) {
              req.log.warn({ err, taskId: t.id }, "Provider deletion request encountered error");
            }
          }
        }
      }

      const revokedAt = new Date();
      await db
        .update(relaySessions)
        .set({
          status: "REVOKED",
          revokedAt,
          updatedAt: revokedAt
        })
        .where(eq(relaySessions.id, auth.sessionId));

      await db.insert(auditEvents).values({
        sessionId: auth.sessionId,
        actorRole: "wearer",
        eventType: "SESSION_REVOKED",
        details: {
          tasks_total: totalTasks,
          tasks_deleted: deletedCount
        }
      });

      eventBus.publish({
        sessionId: auth.sessionId,
        type: "SESSION_REVOKED",
        targetRole: "all",
        payload: { revoked_at: revokedAt.toISOString() }
      });

      return reply.send({
        status: "REVOKED",
        revoked_at: revokedAt.toISOString(),
        tasks_purged: deletedCount,
        tasks_total: totalTasks
      });
    }
  );
};
