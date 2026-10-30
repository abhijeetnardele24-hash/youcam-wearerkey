import type { FastifyPluginAsync } from "fastify";
import { eq, or } from "drizzle-orm";
import {
  hashCapabilityToken,
  verifyTokenHash,
  generateSessionToken,
  hashSessionToken
} from "@wearerkey/domain";
import { BootstrapRequestSchema } from "@wearerkey/contracts";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, auditEvents } from "../db/schema.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Single-use or initial bootstrap route: exchanges URL fragment/token for HttpOnly session cookie
  fastify.post("/api/auth/bootstrap", async (req, reply) => {
    const parseResult = BootstrapRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        details: parseResult.error.format()
      });
    }

    const inputCode = parseResult.data.bootstrap_code || parseResult.data.token;
    const requestedRole = parseResult.data.role;

    if (!inputCode || inputCode.trim().length < 16) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        message: "A valid bootstrap code or capability token of at least 16 characters is required."
      });
    }

    const candidateHash = hashCapabilityToken(inputCode);
    const db = await getDb();

    // Query session matching bootstrap code hash or capability token hash
    const rows = await db
      .select()
      .from(relaySessions)
      .where(
        or(
          eq(relaySessions.wearerBootstrapCodeHash, candidateHash),
          eq(relaySessions.helperBootstrapCodeHash, candidateHash),
          eq(relaySessions.wearerTokenHash, candidateHash),
          eq(relaySessions.helperTokenHash, candidateHash)
        )
      )
      .limit(1);

    const session = rows[0];
    if (!session) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Invalid capability token or bootstrap code."
      });
    }

    let resolvedRole: "wearer" | "helper" | null = null;
    let isSingleUseRedemption = false;

    // 1. Check wearer bootstrap code (Single-Use enforcement)
    if (session.wearerBootstrapCodeHash && verifyTokenHash(candidateHash, session.wearerBootstrapCodeHash)) {
      resolvedRole = "wearer";
      isSingleUseRedemption = true;
      if (session.wearerBootstrapRedeemedAt !== null) {
        return reply.status(409).send({
          error: "BOOTSTRAP_CODE_ALREADY_USED",
          message: "This capability link has already been redeemed. Single-use bootstrap links cannot be replayed."
        });
      }
    }
    // 2. Check helper bootstrap code (Single-Use enforcement)
    else if (session.helperBootstrapCodeHash && verifyTokenHash(candidateHash, session.helperBootstrapCodeHash)) {
      resolvedRole = "helper";
      isSingleUseRedemption = true;
      if (session.helperBootstrapRedeemedAt !== null) {
        return reply.status(409).send({
          error: "BOOTSTRAP_CODE_ALREADY_USED",
          message: "This capability link has already been redeemed. Single-use bootstrap links cannot be replayed."
        });
      }
    }
    // 3. Check legacy/direct capability token hashes
    else if (verifyTokenHash(candidateHash, session.wearerTokenHash)) {
      resolvedRole = "wearer";
    } else if (verifyTokenHash(candidateHash, session.helperTokenHash)) {
      resolvedRole = "helper";
    }

    if (!resolvedRole) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Capability token validation failed."
      });
    }

    if (requestedRole && requestedRole !== resolvedRole) {
      return reply.status(403).send({
        error: "ROLE_MISMATCH",
        message: `Token is authorized for ${resolvedRole}, not ${requestedRole}.`
      });
    }

    if (session.status === "REVOKED") {
      return reply.status(410).send({
        error: "SESSION_REVOKED",
        message: "This Try-On Pass has been revoked by the wearer."
      });
    }

    if (new Date() >= new Date(session.expiresAt) || session.status === "EXPIRED") {
      return reply.status(410).send({
        error: "SESSION_EXPIRED",
        message: "This Try-On Pass has expired."
      });
    }

    // Generate fresh opaque session token stored in cookie and hashed at rest
    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const now = new Date();

    if (resolvedRole === "wearer") {
      await db
        .update(relaySessions)
        .set({
          wearerSessionTokenHash: sessionTokenHash,
          ...(isSingleUseRedemption ? { wearerBootstrapRedeemedAt: now } : {}),
          updatedAt: now
        })
        .where(eq(relaySessions.id, session.id));
    } else {
      await db
        .update(relaySessions)
        .set({
          helperSessionTokenHash: sessionTokenHash,
          ...(isSingleUseRedemption ? { helperBootstrapRedeemedAt: now } : {}),
          updatedAt: now
        })
        .where(eq(relaySessions.id, session.id));
    }

    // Set role-separated and standard secure HttpOnly session cookies
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: Math.max(60, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000))
    };

    if (resolvedRole === "wearer") {
      reply.setCookie("wearerkey_session_wearer", sessionToken, cookieOptions);
    } else {
      reply.setCookie("wearerkey_session_helper", sessionToken, cookieOptions);
    }
    reply.setCookie("wearerkey_session", sessionToken, cookieOptions);

    await db.insert(auditEvents).values({
      sessionId: session.id,
      actorRole: resolvedRole,
      eventType: "SESSION_BOOTSTRAPPED",
      details: { role: resolvedRole, single_use_redeemed: isSingleUseRedemption }
    });

    return reply.send({
      authenticated: true,
      session_id: session.id,
      role: resolvedRole,
      status: session.status,
      expires_at: session.expiresAt.toISOString()
    });
  });
};

