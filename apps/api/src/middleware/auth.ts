import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, or } from "drizzle-orm";
import { hashCapabilityToken, verifyTokenHash } from "@wearerkey/domain";
import { getDb } from "../db/index.js";
import { relaySessions } from "../db/schema.js";

export interface AuthenticatedSession {
  sessionId: string;
  role: "wearer" | "helper";
  session: typeof relaySessions.$inferSelect;
}

declare module "fastify" {
  interface FastifyRequest {
    authSession?: AuthenticatedSession;
  }
}

function extractToken(req: FastifyRequest, expectedRole?: "wearer" | "helper"): string | null {
  // 1. Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 2. Custom capability header: X-Capability-Token
  const capabilityHeader = req.headers["x-capability-token"];
  if (typeof capabilityHeader === "string" && capabilityHeader.trim().length > 0) {
    return capabilityHeader.trim();
  }

  // 3. Purge Recovery Header: X-Purge-Recovery-Token
  const purgeHeader = req.headers["x-purge-recovery-token"];
  if (typeof purgeHeader === "string" && purgeHeader.trim().length > 0) {
    return purgeHeader.trim();
  }

  // 4. Role-isolated HttpOnly session cookie (prevents cross-role collision in split view)
  if (req.cookies) {
    if (expectedRole === "wearer" && req.cookies.wearerkey_session_wearer) {
      return req.cookies.wearerkey_session_wearer.trim();
    }
    if (expectedRole === "helper" && req.cookies.wearerkey_session_helper) {
      return req.cookies.wearerkey_session_helper.trim();
    }
    if (req.cookies.wearerkey_session) {
      return req.cookies.wearerkey_session.trim();
    }
  }

  // SECURITY REQUIREMENT: Query parameter tokens are strictly rejected to prevent referrer/log leakage
  return null;
}

export function requireRole(expectedRole: "wearer" | "helper") {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const rawToken = extractToken(req, expectedRole);
    if (!rawToken) {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: `Missing capability token or session cookie for ${expectedRole} access.`
      });
    }

    const tokenHash = hashCapabilityToken(rawToken);
    const db = await getDb();

    // Query session matching session token hash or legacy token hash
    const rows = await db
      .select()
      .from(relaySessions)
      .where(
        expectedRole === "wearer"
          ? or(eq(relaySessions.wearerSessionTokenHash, tokenHash), eq(relaySessions.wearerTokenHash, tokenHash))
          : or(eq(relaySessions.helperSessionTokenHash, tokenHash), eq(relaySessions.helperTokenHash, tokenHash))
      )
      .limit(1);

    const session = rows[0];
    if (!session) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Invalid capability token or unauthorized role boundary."
      });
    }

    // Verify constant-time
    const candidateHash = tokenHash;
    const isSessionMatch =
      expectedRole === "wearer"
        ? session.wearerSessionTokenHash && verifyTokenHash(candidateHash, session.wearerSessionTokenHash)
        : session.helperSessionTokenHash && verifyTokenHash(candidateHash, session.helperSessionTokenHash);
    const isTokenMatch =
      expectedRole === "wearer"
        ? verifyTokenHash(candidateHash, session.wearerTokenHash)
        : verifyTokenHash(candidateHash, session.helperTokenHash);

    if (!isSessionMatch && !isTokenMatch) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Capability token validation failed."
      });
    }

    // Check revocation: normal routes fail closed with 410
    if (session.status === "REVOKED") {
      return reply.status(410).send({
        error: "SESSION_REVOKED",
        message: "This Try-On Pass has been revoked by the wearer."
      });
    }

    // Check expiry
    if (new Date() >= new Date(session.expiresAt) || session.status === "EXPIRED") {
      if (session.status !== "EXPIRED") {
        await db
          .update(relaySessions)
          .set({ status: "EXPIRED" })
          .where(eq(relaySessions.id, session.id));
      }
      return reply.status(410).send({
        error: "SESSION_EXPIRED",
        message: "This Try-On Pass has expired."
      });
    }

    req.authSession = {
      sessionId: session.id,
      role: expectedRole,
      session
    };
  };
}

/**
 * Authorization for post-revocation purge recovery and final deletion receipt.
 * Permits access ONLY via:
 * 1. Dedicated, unexpired purge recovery token (X-Purge-Recovery-Token / Bearer token)
 * 2. Wearer session token / capability token (even after revocation)
 */
export async function requirePurgeRecoveryAuth(req: FastifyRequest, reply: FastifyReply) {
  const rawToken = extractToken(req, "wearer");
  if (!rawToken) {
    return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "Missing purge recovery token or wearer session authorization."
    });
  }

  const tokenHash = hashCapabilityToken(rawToken);
  const db = await getDb();

  // Find session where tokenHash matches purge recovery token, wearer session token, or wearer capability token
  const rows = await db
    .select()
    .from(relaySessions)
    .where(
      or(
        eq(relaySessions.purgeRecoveryTokenHash, tokenHash),
        eq(relaySessions.wearerSessionTokenHash, tokenHash),
        eq(relaySessions.wearerTokenHash, tokenHash)
      )
    )
    .limit(1);

  const session = rows[0];
  if (!session) {
    return reply.status(403).send({
      error: "FORBIDDEN",
      message: "Invalid purge recovery token or unauthorized access."
    });
  }

  // If matched via purge recovery token, check expiration
  if (session.purgeRecoveryTokenHash && verifyTokenHash(tokenHash, session.purgeRecoveryTokenHash)) {
    if (session.purgeRecoveryExpiresAt && new Date() >= new Date(session.purgeRecoveryExpiresAt)) {
      return reply.status(410).send({
        error: "PURGE_TOKEN_EXPIRED",
        message: "This purge recovery token has expired."
      });
    }
  }

  req.authSession = {
    sessionId: session.id,
    role: "wearer",
    session
  };
}
