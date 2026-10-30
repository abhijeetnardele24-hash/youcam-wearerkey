import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
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

function extractToken(req: FastifyRequest): string | null {
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

  // 3. HttpOnly session cookie set via /api/auth/bootstrap
  if (req.cookies && req.cookies.wearerkey_session) {
    return req.cookies.wearerkey_session.trim();
  }

  // SECURITY REQUIREMENT: Query parameter tokens are strictly rejected to prevent referrer/log leakage
  return null;
}

export function requireRole(expectedRole: "wearer" | "helper") {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const rawToken = extractToken(req);
    if (!rawToken) {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: `Missing capability token or session cookie for ${expectedRole} access.`
      });
    }

    const tokenHash = hashCapabilityToken(rawToken);
    const db = await getDb();

    // Query session by token hash
    const rows = await db
      .select()
      .from(relaySessions)
      .where(
        expectedRole === "wearer"
          ? eq(relaySessions.wearerTokenHash, tokenHash)
          : eq(relaySessions.helperTokenHash, tokenHash)
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
    const storedHash = expectedRole === "wearer" ? session.wearerTokenHash : session.helperTokenHash;
    if (!verifyTokenHash(tokenHash, storedHash)) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Capability token validation failed."
      });
    }

    // Check revocation
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
