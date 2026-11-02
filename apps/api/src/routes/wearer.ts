import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { SubmitDecisionRequestSchema } from "@wearerkey/contracts";
import { decryptProviderIdentifier } from "@wearerkey/domain";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { proposals, providerTasks, decisions, auditEvents } from "../db/schema.js";
import { requireRole, requireReceiptAccessAuth } from "../middleware/auth.js";
import { eventBus } from "../services/event-bus.js";
import { ephemeralImageStore } from "../services/garment-store.js";
import { request } from "undici";
import {
  verifyRecordedResultProvenance,
  isPathInApprovedDirectory,
  BUNDLED_SYNTHETIC_SAMPLE_SHA256
} from "../providers/youcam/provenance.js";

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
        const providerMode = (task?.mode as any) || "DEMO_FIXTURE";

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
          provider_mode: providerMode,
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

      const encKey = config.PROVIDER_ID_ENCRYPTION_KEY || config.ENCRYPTION_KEY_HEX;
      const rawResultUrl = decryptProviderIdentifier(task.resultUrlCiphertext, encKey);

      // If result URL is a remote HTTP(S) URL, it must ALWAYS undergo strict SSRF protection
      const isRemoteUrl = rawResultUrl.startsWith("http://") || rawResultUrl.startsWith("https://");
      const fallbackPath = path.resolve(publicDir, "sample_vto_result.png");

      if (!isRemoteUrl) {
        // 1. Explicitly serve bundled fixture when mode is DEMO_FIXTURE
        if (task.mode === "DEMO_FIXTURE") {
          const fixturePath = path.resolve(publicDir, "sample_vto_result.png");
          if (fs.existsSync(fixturePath)) {
            reply.header("Content-Type", "image/png");
            reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
            return reply.send(fs.readFileSync(fixturePath));
          }
          return reply.status(404).send({ error: "FIXTURE_NOT_FOUND", message: "Bundled demo fixture asset missing" });
        }

        // 2. Strictly serve verified recorded live result when mode is RECORDED_LIVE_RESULT
        if (task.mode === "RECORDED_LIVE_RESULT") {
          const repoRoot = fs.existsSync(path.resolve(__dirname, "../../../../package.json"))
            ? path.resolve(__dirname, "../../../..")
            : process.cwd();

          const provenanceCheck = verifyRecordedResultProvenance({ rootDir: repoRoot });
          if (!provenanceCheck.valid || !provenanceCheck.manifest || !provenanceCheck.resultFilePath) {
            // Never fall back to synthetic fixture while retaining recorded-live mode
            return reply.status(500).send({
              error: "RECORDED_PROVENANCE_FAILED",
              message: provenanceCheck.reason || "Recorded live result failed provenance validation."
            });
          }

          // Constrain to approved server-owned directory & reject traversal/arbitrary paths
          if (!isPathInApprovedDirectory(provenanceCheck.manifest.result_file, repoRoot)) {
            return reply.status(403).send({
              error: "ACCESS_DENIED",
              message: "Result file is outside approved public directories or contains traversal."
            });
          }

          const resolvedPath = path.resolve(repoRoot, provenanceCheck.manifest.result_file);
          if (!fs.existsSync(resolvedPath)) {
            return reply.status(404).send({
              error: "RESULT_FILE_NOT_FOUND",
              message: "Validated recorded result file not found on disk."
            });
          }

          // Read bytes and verify SHA-256 again before returning bytes
          const servedBytes = fs.readFileSync(resolvedPath);
          const servedSha256 = crypto.createHash("sha256").update(servedBytes).digest("hex");

          // Reject if matches bundled synthetic fixture
          if (servedSha256.toLowerCase() === BUNDLED_SYNTHETIC_SAMPLE_SHA256.toLowerCase()) {
            return reply.status(500).send({
              error: "FORBIDDEN_SYNTHETIC_SAMPLE",
              message: "Served bytes match bundled synthetic demo fixture; cannot serve as recorded live result."
            });
          }

          // Ensure returned bytes match manifest
          if (servedSha256.toLowerCase() !== provenanceCheck.manifest.result_image_sha256.toLowerCase()) {
            return reply.status(500).send({
              error: "SERVED_BYTE_MISMATCH",
              message: `Served file hash (${servedSha256}) does not match manifest (${provenanceCheck.manifest.result_image_sha256}).`
            });
          }

          // Ensure returned bytes match live receipt
          const liveReceiptPath = path.isAbsolute(provenanceCheck.manifest.live_receipt_file)
            ? provenanceCheck.manifest.live_receipt_file
            : path.resolve(repoRoot, provenanceCheck.manifest.live_receipt_file);

          if (!fs.existsSync(liveReceiptPath)) {
            return reply.status(500).send({
              error: "RECEIPT_NOT_FOUND",
              message: "Referenced live receipt not found on disk."
            });
          }

          let receipt: any;
          try {
            receipt = JSON.parse(fs.readFileSync(liveReceiptPath, "utf-8"));
          } catch (err: any) {
            return reply.status(500).send({
              error: "MALFORMED_RECEIPT",
              message: `Malformed JSON in live receipt: ${err.message}`
            });
          }

          const receiptHash = receipt.result_image_sha256 || receipt.result_sha256 || receipt.image_hash;
          if (!receiptHash || receiptHash.toLowerCase() !== servedSha256.toLowerCase()) {
            return reply.status(500).send({
              error: "RECEIPT_BYTE_MISMATCH",
              message: `Served file hash (${servedSha256}) does not match receipt hash (${receiptHash}).`
            });
          }

          reply.header("Content-Type", "image/png");
          reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
          return reply.send(servedBytes);
        }

        // Local fallback for dev/mock URL testing
        if (rawResultUrl.startsWith("/") || rawResultUrl.includes("fake.youcam.local")) {
          if (fs.existsSync(fallbackPath)) {
            reply.header("Content-Type", "image/png");
            reply.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
            return reply.send(fs.readFileSync(fallbackPath));
          }
          return reply.redirect(rawResultUrl.startsWith("/") ? rawResultUrl : "/assets/sample_vto_result.png");
        }
      }

      // SSRF Protection: Restrict remote fetch strictly to authorized YouCam CDN domains
      try {
        const parsed = new URL(rawResultUrl);
        const host = parsed.hostname.toLowerCase();
        const isProd = config.NODE_ENV === "production";

        // 1. Enforce HTTPS (allow HTTP in dev only for localhost testing)
        if (isProd && parsed.protocol !== "https:") {
          return reply.status(403).send({ error: "SSRF_BLOCKED", message: "Only HTTPS result URLs are permitted in production." });
        }

        // 2. Reject credentials in URL (e.g. https://user:pass@evil.com)
        if (parsed.username || parsed.password) {
          return reply.status(403).send({ error: "SSRF_BLOCKED", message: "Result URLs with userinfo credentials are forbidden." });
        }

        // 3. Reject non-standard ports
        if (parsed.port && parsed.port !== "443" && !(isProd === false && (parsed.port === "4000" || parsed.port === "5173"))) {
          return reply.status(403).send({ error: "SSRF_BLOCKED", message: "Non-standard ports are forbidden." });
        }

        // 4. Reject private / link-local / metadata IP addresses
        const isPrivateIp = (h: string) => {
          if (h === "localhost" || h === "127.0.0.1" || h === "::1") return !isProd ? false : true;
          if (/^10\./.test(h)) return true;
          if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
          if (/^192\.168\./.test(h)) return true;
          if (/^169\.254\./.test(h)) return true;
          if (/^fc[0-9a-f]{2}:/i.test(h)) return true;
          if (/^fe80:/i.test(h)) return true;
          return false;
        };

        if (isPrivateIp(host)) {
          return reply.status(403).send({ error: "SSRF_BLOCKED", message: "Private and internal IP ranges are forbidden." });
        }

        const isAuthorizedHost =
          host === "yce-api-01.makeupar.com" ||
          host.endsWith(".makeupar.com") ||
          host.endsWith(".perfectcorp.com") ||
          (!isProd && (host === "localhost" || host === "127.0.0.1"));

        if (!isAuthorizedHost) {
          req.log.warn({ host }, "Blocked attempt to stream result from unauthorized host");
          return reply.status(403).send({ error: "SSRF_BLOCKED", message: "Result origin domain not allowed by SSRF policy" });
        }
      } catch {
        return reply.status(400).send({ error: "INVALID_RESULT_URL" });
      }

      // Stream from YouCam CDN directly to wearer browser with redirection disabled
      try {
        const streamRes = await request(rawResultUrl, { method: "GET", maxRedirections: 0 });
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
    { preHandler: [requireReceiptAccessAuth] },
    async (req, reply) => {
      const auth = req.authSession!;
      const session = auth.session;

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
        return reply.status(500).send({
          error: "RECEIPT_INTEGRITY_ERROR",
          message: "Persisted receipt record is malformed."
        });
      }
    }
  );
};
