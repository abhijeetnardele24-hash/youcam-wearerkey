import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import {
  evaluateConsentGate,
  generateProposalFingerprint,
  encryptProviderIdentifier,
  mapYouCamError
} from "@wearerkey/domain";
import { SubmitProposalRequestSchema, GarmentCategorySchema } from "@wearerkey/contracts";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, proposals, providerTasks, decisions, auditEvents } from "../db/schema.js";
import { requireRole } from "../middleware/auth.js";
import { sanitizeAndValidateImage } from "../services/image-sanitizer.js";
import { getProvider } from "../providers/youcam/index.js";
import { eventBus } from "../services/event-bus.js";

export const helperRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Helper Room View (ZERO Wearer or Result Images!)
  fastify.get(
    "/api/helper/session",
    { preHandler: [requireRole("helper")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const db = await getDb();

      const propRows = await db
        .select()
        .from(proposals)
        .where(eq(proposals.sessionId, auth.sessionId));

      const helperProposalDTOs = [];
      for (const p of propRows) {
        const decRows = await db
          .select()
          .from(decisions)
          .where(eq(decisions.proposalId, p.id))
          .limit(1);

        helperProposalDTOs.push({
          id: p.id,
          label: p.label,
          garment_category: p.garmentCategory as any,
          price_minor: auth.session.giftMode ? null : p.priceMinor,
          currency: p.currency,
          product_url: auth.session.giftMode ? null : p.productUrl,
          brand: auth.session.giftMode ? null : p.brand,
          status: p.status as any,
          decision: decRows[0]?.decision as any,
          wearer_note: decRows[0]?.note || null,
          garment_preview_url: `/api/helper/proposals/${p.id}/garment`,
          failure_code: p.failureCode,
          failure_message_safe: p.failureMessageSafe,
          created_at: p.createdAt.toISOString(),
          completed_at: p.completedAt ? p.completedAt.toISOString() : null
          // CRITICAL PRIVACY BOUNDARY: Result image and wearer photo are never included here!
        });
      }

      const s = auth.session;
      return reply.send({
        id: s.id,
        status: s.status,
        allowed_categories: s.allowedCategories,
        max_proposals: s.maxProposals,
        proposals_remaining: Math.max(0, s.maxProposals - helperProposalDTOs.length),
        expires_at: s.expiresAt.toISOString(),
        gift_mode: s.giftMode,
        wearer_photo_status: "PROTECTED_NOT_SHARED",
        created_at: s.createdAt.toISOString(),
        proposals: helperProposalDTOs
      });
    }
  );

  // 2. Helper Proposes a Garment (Multipart upload)
  fastify.post(
    "/api/helper/proposals",
    { preHandler: [requireRole("helper")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const parts = req.parts();

      let imageBuffer: Buffer | null = null;
      const fields: Record<string, string> = {};

      for await (const part of parts) {
        if (part.type === "file") {
          imageBuffer = await part.toBuffer();
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      if (!imageBuffer) {
        return reply.status(400).send({
          error: "MISSING_IMAGE",
          message: "Please attach a garment image."
        });
      }

      const parsedFields = SubmitProposalRequestSchema.safeParse({
        label: fields.label || "Candidate Garment",
        garment_category: fields.garment_category,
        price_minor: fields.price_minor ? Number(fields.price_minor) : undefined,
        currency: fields.currency || "USD",
        product_url: fields.product_url || undefined,
        brand: fields.brand || undefined
      });

      if (!parsedFields.success) {
        return reply.status(400).send({
          error: "INVALID_METADATA",
          details: parsedFields.error.format()
        });
      }

      let sanitized;
      try {
        sanitized = await sanitizeAndValidateImage(imageBuffer);
      } catch (err: any) {
        return reply.status(400).send({
          error: err.code || "IMAGE_VALIDATION_ERROR",
          message: err.message
        });
      }

      const provider = getProvider();
      let uploadedFile;
      try {
        uploadedFile = await provider.uploadImage(sanitized, "garment");
      } catch (err: any) {
        req.log.error({ err }, "YouCam File API garment upload failed");
        return reply.status(502).send({
          error: "PROVIDER_UPLOAD_ERROR",
          message: "Failed to upload garment to virtual try-on engine. Please try again."
        });
      }

      const meta = parsedFields.data;
      const encryptedFileId = encryptProviderIdentifier(uploadedFile.fileId, config.ENCRYPTION_KEY_HEX);

      const fingerprint = generateProposalFingerprint({
        sessionId: auth.sessionId,
        sourceContentHash: auth.session.sourceContentHash || "no_source",
        garmentContentHash: sanitized.contentHash,
        category: meta.garment_category,
        consentVersion: auth.session.consentVersion
      });

      const db = await getDb();

      const inserted = await db
        .insert(proposals)
        .values({
          sessionId: auth.sessionId,
          label: meta.label,
          garmentCategory: meta.garment_category,
          priceMinor: meta.price_minor,
          currency: meta.currency,
          productUrl: meta.product_url,
          brand: meta.brand,
          garmentFileIdCiphertext: encryptedFileId,
          garmentContentHash: sanitized.contentHash,
          idempotencyFingerprint: fingerprint,
          status: "READY"
        })
        .returning();

      const prop = inserted[0];

      await db.insert(auditEvents).values({
        sessionId: auth.sessionId,
        actorRole: "helper",
        eventType: "PROPOSAL_CREATED",
        details: { proposal_id: prop.id, label: prop.label, category: prop.garmentCategory }
      });

      eventBus.publish({
        sessionId: auth.sessionId,
        type: "PROPOSAL_CREATED",
        targetRole: "all",
        payload: { proposal_id: prop.id, label: prop.label, category: prop.garmentCategory }
      });

      return reply.status(201).send({
        proposal_id: prop.id,
        status: prop.status,
        label: prop.label,
        category: prop.garmentCategory
      });
    }
  );

  // 3. Request Try-On Generation (Atomic Consent Gate & Provider Orchestration)
  fastify.post(
    "/api/helper/proposals/:id/generate",
    { preHandler: [requireRole("helper")] },
    async (req, reply) => {
      const auth = req.authSession!;
      const { id } = req.params as { id: string };
      const db = await getDb();

      const pRows = await db
        .select()
        .from(proposals)
        .where(eq(proposals.id, id))
        .limit(1);

      const prop = pRows[0];
      if (!prop || prop.sessionId !== auth.sessionId) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "Proposal not found" });
      }

      // Query current proposal count
      const allProps = await db
        .select()
        .from(proposals)
        .where(eq(proposals.sessionId, auth.sessionId));

      // Atomic Consent Gate Verification
      const gateResult = evaluateConsentGate({
        sessionStatus: auth.session.status as any,
        expiresAt: auth.session.expiresAt,
        allowedCategories: auth.session.allowedCategories as any,
        garmentCategory: prop.garmentCategory as any,
        maxProposals: auth.session.maxProposals,
        currentProposalCount: allProps.filter((p) => p.status === "SUCCEEDED" || p.status === "PROCESSING").length,
        hasSourceImage: !!auth.session.sourceContentHash,
        hasGarmentImage: !!prop.garmentContentHash,
        duplicateFingerprintExists: false
      });

      if (!gateResult.allowed) {
        await db
          .update(proposals)
          .set({ status: "GATE_BLOCKED", failureCode: gateResult.code, failureMessageSafe: gateResult.reason })
          .where(eq(proposals.id, id));

        return reply.status(403).send({
          error: "CONSENT_GATE_BLOCKED",
          code: gateResult.code,
          reason: gateResult.reason
        });
      }

      // Update proposal state to UPLOADING -> SUBMITTED
      await db
        .update(proposals)
        .set({ status: "PROCESSING" })
        .where(eq(proposals.id, id));

      eventBus.publish({
        sessionId: auth.sessionId,
        type: "TASK_STATUS_CHANGED",
        targetRole: "all",
        payload: { proposal_id: id, status: "PROCESSING" }
      });

      const provider = getProvider();

      // Trigger asynchronous task
      try {
        const task = await provider.createTask({
          srcFileId: "src_ready",
          refFileId: "garment_ready",
          garmentCategory: prop.garmentCategory as any,
          filterMultiPerson: "strict"
        });

        // Record provider task
        const encryptedTaskId = encryptProviderIdentifier(task.taskId, config.ENCRYPTION_KEY_HEX);

        await db.insert(providerTasks).values({
          proposalId: id,
          provider: "YOUCAM",
          mode: provider.mode,
          apiFamily: "AI_CLOTHES_V4",
          taskIdCiphertext: encryptedTaskId,
          estimatedUnits: task.estimatedUnits,
          providerStatus: "SUBMITTED"
        });

        // Poll task to completion
        const taskStatus = await provider.pollTask(task.taskId);

        if (taskStatus.status === "SUCCEEDED" && taskStatus.resultUrl) {
          const encryptedResultUrl = encryptProviderIdentifier(taskStatus.resultUrl, config.ENCRYPTION_KEY_HEX);

          await db
            .update(providerTasks)
            .set({
              providerStatus: "SUCCEEDED",
              resultUrlCiphertext: encryptedResultUrl,
              observedUnits: taskStatus.observedUnits || 2,
              finishedAt: new Date()
            })
            .where(eq(providerTasks.proposalId, id));

          await db
            .update(proposals)
            .set({ status: "SUCCEEDED", completedAt: new Date() })
            .where(eq(proposals.id, id));

          eventBus.publish({
            sessionId: auth.sessionId,
            type: "TASK_STATUS_CHANGED",
            targetRole: "all",
            payload: { proposal_id: id, status: "SUCCEEDED" }
          });

          return reply.send({
            status: "SUCCEEDED",
            proposal_id: id,
            mode: provider.mode,
            message: "Virtual try-on completed. Result is available privately in wearer room."
          });
        } else {
          const safeError = mapYouCamError(taskStatus.errorCode, taskStatus.errorMessage);

          await db
            .update(providerTasks)
            .set({
              providerStatus: "FAILED",
              providerErrorCode: taskStatus.errorCode,
              finishedAt: new Date()
            })
            .where(eq(providerTasks.proposalId, id));

          await db
            .update(proposals)
            .set({
              status: "FAILED",
              failureCode: safeError.code,
              failureMessageSafe: safeError.userMessage
            })
            .where(eq(proposals.id, id));

          eventBus.publish({
            sessionId: auth.sessionId,
            type: "TASK_STATUS_CHANGED",
            targetRole: "all",
            payload: { proposal_id: id, status: "FAILED", error: safeError.userMessage }
          });

          return reply.status(422).send({
            status: "FAILED",
            error: safeError.code,
            message: safeError.userMessage,
            actionable_step: safeError.actionableStep
          });
        }
      } catch (err: any) {
        req.log.error({ err }, "Task creation or polling failed");
        await db
          .update(proposals)
          .set({ status: "FAILED", failureCode: "PROVIDER_ERROR", failureMessageSafe: err.message })
          .where(eq(proposals.id, id));

        return reply.status(502).send({
          error: "PROVIDER_ERROR",
          message: err.message || "Failed to communicate with virtual try-on engine."
        });
      }
    }
  );

  // 4. Helper Redacted Receipt
  fastify.get(
    "/api/helper/receipt",
    { preHandler: [requireRole("helper")] },
    async (req, reply) => {
      const auth = req.authSession!;
      return reply.send({
        schema_version: "1.0",
        session_id: auth.sessionId,
        status: auth.session.status,
        wearer_photo_status: "PROTECTED_NOT_SHARED",
        local_access_revoked: auth.session.status === "REVOKED",
        evidence_authority: "WEARERKEY_AUDITABLE_LEDGER"
      });
    }
  );
};
