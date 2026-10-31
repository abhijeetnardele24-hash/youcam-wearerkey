import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, or } from "drizzle-orm";
import { hashSessionToken, hashPurgeRecoveryToken, verifyTokenHash } from "@wearerkey/domain";
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

/**
 * Extracts opaque session token strictly from role-isolated HttpOnly cookies.
 * Ordinary API endpoints reject query tokens, URL path tokens, and Bearer capability tokens.
 */
function extractSessionCookie(req: FastifyRequest, expectedRole: "wearer" | "helper"): string | null {
  if (!req.cookies) {
    return null;
  }

  // 1. Role-specific session cookie (isolates split-screen iframe tabs on the same origin)
  if (expectedRole === "wearer" && req.cookies.wearerkey_session_wearer) {
    return req.cookies.wearerkey_session_wearer.trim();
  }
  if (expectedRole === "helper" && req.cookies.wearerkey_session_helper) {
    return req.cookies.wearerkey_session_helper.trim();
  }

  // 2. Generic session cookie fallback
  if (req.cookies.wearerkey_session) {
    return req.cookies.wearerkey_session.trim();
  }

  return null;
}

/**
 * Enforces role authorization strictly via opaque HttpOnly session cookies.
 * Reusable capability tokens cannot authorize ordinary role operations.
 */
export function requireRole(expectedRole: "wearer" | "helper") {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const rawSessionToken = extractSessionCookie(req, expectedRole);
    if (!rawSessionToken) {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: `Missing authenticated session cookie for ${expectedRole} access. Please redeem a bootstrap link.`
      });
    }

    const tokenHash = hashSessionToken(rawSessionToken);
    const db = await getDb();

    // Query session matching the session token hash for the expected role
    const rows = await db
      .select()
      .from(relaySessions)
      .where(
        expectedRole === "wearer"
          ? eq(relaySessions.wearerSessionTokenHash, tokenHash)
          : eq(relaySessions.helperSessionTokenHash, tokenHash)
      )
      .limit(1);

    let session = rows[0];

    // If not found in active tokens, check if this token belongs to an already revoked session
    if (!session) {
      const revokedRows = await db
        .select()
        .from(relaySessions)
        .where(
          expectedRole === "wearer"
            ? eq(relaySessions.revokedWearerSessionTokenHash, tokenHash)
            : eq(relaySessions.revokedHelperSessionTokenHash, tokenHash)
        )
        .limit(1);

      if (revokedRows.length > 0) {
        return reply.status(410).send({
          error: "SESSION_REVOKED",
          message: "This Try-On Pass has been revoked by the wearer."
        });
      }

      return reply.status(403).send({
        error: "FORBIDDEN",
        message: `Invalid session cookie or unauthorized ${expectedRole} role boundary.`
      });
    }

    // Constant-time verification
    const storedHash =
      expectedRole === "wearer" ? session.wearerSessionTokenHash : session.helperSessionTokenHash;

    if (!storedHash || !verifyTokenHash(tokenHash, storedHash)) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Session credential verification failed."
      });
    }

    // Revocation check: ordinary role routes fail closed with HTTP 410
    if (session.status === "REVOKED") {
      return reply.status(410).send({
        error: "SESSION_REVOKED",
        message: "This Try-On Pass has been revoked by the wearer."
      });
    }

    // Expiration check: expired sessions fail closed with HTTP 410
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
 * Strictly scoped credential:
 * - Permits access ONLY via dedicated HttpOnly cookie (wearerkey_purge_recovery) or header (X-Purge-Recovery-Token)
 * - Original wearer, helper, or bootstrap credentials CANNOT authorize purge recovery
 * - Fails closed upon expiration or unconfirmed state
 */
export async function requirePurgeRecoveryAuth(req: FastifyRequest, reply: FastifyReply) {
  let rawToken: string | null = null;

  // 1. Dedicated Secure HttpOnly purge-recovery cookie
  if (req.cookies && req.cookies.wearerkey_purge_recovery) {
    rawToken = req.cookies.wearerkey_purge_recovery.trim();
  }

  // 2. Dedicated Purge Recovery Header for non-browser/API clients
  if (!rawToken) {
    const purgeHeader = req.headers["x-purge-recovery-token"];
    if (typeof purgeHeader === "string" && purgeHeader.trim().length > 0) {
      rawToken = purgeHeader.trim();
    }
  }

  if (rawToken) {
    const tokenHash = hashPurgeRecoveryToken(rawToken);
    const db = await getDb();

    // Find session strictly where tokenHash matches purge recovery token
    const rows = await db
      .select()
      .from(relaySessions)
      .where(eq(relaySessions.purgeRecoveryTokenHash, tokenHash))
      .limit(1);

    const session = rows[0];
    if (!session || !session.purgeRecoveryTokenHash || !verifyTokenHash(tokenHash, session.purgeRecoveryTokenHash)) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Invalid purge recovery credential."
      });
    }

    // Expiration check for recovery window
    if (session.purgeRecoveryExpiresAt && new Date() >= new Date(session.purgeRecoveryExpiresAt)) {
      return reply.status(410).send({
        error: "PURGE_TOKEN_EXPIRED",
        message: "This purge recovery credential has expired."
      });
    }

    req.authSession = {
      sessionId: session.id,
      role: "wearer",
      session
    };
    return;
  }

  // 3. Fallback: Authenticated Wearer session cookie (allows wearer to inspect receipt or retry purge)
  // Reusable helper tokens, bootstrap codes, and unauthenticated callers are rejected.
  const wearerCookie = req.cookies?.wearerkey_session_wearer || req.cookies?.wearerkey_session;
  if (wearerCookie) {
    const tokenHash = hashSessionToken(wearerCookie.trim());
    const db = await getDb();

    const rows = await db
      .select()
      .from(relaySessions)
      .where(
        or(
          eq(relaySessions.wearerSessionTokenHash, tokenHash),
          eq(relaySessions.revokedWearerSessionTokenHash, tokenHash)
        )
      )
      .limit(1);

    const session = rows[0];
    if (session) {
      const storedHash = session.wearerSessionTokenHash === tokenHash
        ? session.wearerSessionTokenHash
        : session.revokedWearerSessionTokenHash;

      if (storedHash && verifyTokenHash(tokenHash, storedHash)) {
        // Wearer can inspect receipt or retry purge until hard session expiration
        if (session.expiresAt && new Date() >= new Date(session.expiresAt)) {
          return reply.status(410).send({
            error: "SESSION_EXPIRED",
            message: "This Try-On Pass has reached hard expiration."
          });
        }

        req.authSession = {
          sessionId: session.id,
          role: "wearer",
          session
        };
        return;
      }
    }
  }

  return reply.status(401).send({
    error: "UNAUTHORIZED",
    message: "Missing dedicated purge recovery credential or wearer session. Standard helper tokens cannot access purge recovery."
  });
}
