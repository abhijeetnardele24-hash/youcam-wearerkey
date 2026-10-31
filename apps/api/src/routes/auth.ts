import type { FastifyPluginAsync } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import {
  hashBootstrapCode,
  generateSessionToken,
  hashSessionToken
} from "@wearerkey/domain";
import { BootstrapRequestSchema } from "@wearerkey/contracts";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { relaySessions, auditEvents } from "../db/schema.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Single-use bootstrap route: atomically exchanges URL fragment bootstrap code for HttpOnly session cookie
  fastify.post("/api/auth/bootstrap", async (req, reply) => {
    const parseResult = BootstrapRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        details: parseResult.error.format()
      });
    }

    const { bootstrap_code: inputCode, role: requestedRole } = parseResult.data;
    const candidateHash = hashBootstrapCode(inputCode);
    const db = await getDb();
    const now = new Date();

    // 1. Identify matching session without consuming code yet
    const wearerMatches = await db
      .select()
      .from(relaySessions)
      .where(eq(relaySessions.wearerBootstrapCodeHash, candidateHash))
      .limit(1);

    const helperMatches = await db
      .select()
      .from(relaySessions)
      .where(eq(relaySessions.helperBootstrapCodeHash, candidateHash))
      .limit(1);

    let resolvedRole: "wearer" | "helper" | null = null;
    let candidateSession: typeof relaySessions.$inferSelect | null = null;
    let isAlreadyRedeemed = false;

    if (wearerMatches.length > 0) {
      resolvedRole = "wearer";
      candidateSession = wearerMatches[0];
      isAlreadyRedeemed = candidateSession.wearerBootstrapRedeemedAt !== null;
    } else if (helperMatches.length > 0) {
      resolvedRole = "helper";
      candidateSession = helperMatches[0];
      isAlreadyRedeemed = candidateSession.helperBootstrapRedeemedAt !== null;
    }

    if (!candidateSession || !resolvedRole) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Invalid bootstrap code."
      });
    }

    // 2. Pre-check: If already redeemed, reject with 409 (prevents code reuse)
    if (isAlreadyRedeemed) {
      return reply.status(409).send({
        error: "BOOTSTRAP_CODE_ALREADY_USED",
        message: "This capability link has already been redeemed. Single-use bootstrap links cannot be replayed."
      });
    }

    // 3. Pre-check: Role mismatch check if caller explicitly requested a specific role (preserves code for proper user)
    if (requestedRole && requestedRole !== resolvedRole) {
      return reply.status(403).send({
        error: "ROLE_MISMATCH",
        message: `Bootstrap code is authorized for ${resolvedRole}, not ${requestedRole}.`
      });
    }

    // 4. Pre-check: Revocation check
    if (candidateSession.status === "REVOKED") {
      return reply.status(410).send({
        error: "SESSION_REVOKED",
        message: "This Try-On Pass has been revoked by the wearer."
      });
    }

    // 5. Pre-check: Expiration check
    if (new Date() >= new Date(candidateSession.expiresAt) || candidateSession.status === "EXPIRED") {
      if (candidateSession.status !== "EXPIRED") {
        await db
          .update(relaySessions)
          .set({ status: "EXPIRED" })
          .where(eq(relaySessions.id, candidateSession.id));
      }
      return reply.status(410).send({
        error: "SESSION_EXPIRED",
        message: "This Try-On Pass has expired."
      });
    }

    // 6. Atomic conditional redemption (concurrency-safe: exactly one winner if raced)
    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);

    let redeemedSession: typeof relaySessions.$inferSelect | null = null;

    if (resolvedRole === "wearer") {
      const updateResult = await db
        .update(relaySessions)
        .set({
          wearerBootstrapRedeemedAt: now,
          wearerSessionTokenHash: sessionTokenHash,
          updatedAt: now
        })
        .where(
          and(
            eq(relaySessions.id, candidateSession.id),
            eq(relaySessions.wearerBootstrapCodeHash, candidateHash),
            isNull(relaySessions.wearerBootstrapRedeemedAt)
          )
        )
        .returning();

      if (updateResult.length > 0) {
        redeemedSession = updateResult[0];
      }
    } else {
      const updateResult = await db
        .update(relaySessions)
        .set({
          helperBootstrapRedeemedAt: now,
          helperSessionTokenHash: sessionTokenHash,
          updatedAt: now
        })
        .where(
          and(
            eq(relaySessions.id, candidateSession.id),
            eq(relaySessions.helperBootstrapCodeHash, candidateHash),
            isNull(relaySessions.helperBootstrapRedeemedAt)
          )
        )
        .returning();

      if (updateResult.length > 0) {
        redeemedSession = updateResult[0];
      }
    }

    if (!redeemedSession) {
      // A concurrent request won the redemption race
      return reply.status(409).send({
        error: "BOOTSTRAP_CODE_ALREADY_USED",
        message: "This capability link has already been redeemed. Single-use bootstrap links cannot be replayed."
      });
    }

    // 7. Set role-separated and standard secure HttpOnly session cookies
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: Math.max(60, Math.floor((new Date(redeemedSession.expiresAt).getTime() - Date.now()) / 1000))
    };

    if (resolvedRole === "wearer") {
      reply.setCookie("wearerkey_session_wearer", sessionToken, cookieOptions);
    } else {
      reply.setCookie("wearerkey_session_helper", sessionToken, cookieOptions);
    }
    reply.setCookie("wearerkey_session", sessionToken, cookieOptions);

    await db.insert(auditEvents).values({
      sessionId: redeemedSession.id,
      actorRole: resolvedRole,
      eventType: "SESSION_BOOTSTRAPPED",
      details: { role: resolvedRole, single_use_redeemed: true }
    });

    return reply.send({
      authenticated: true,
      session_id: redeemedSession.id,
      role: resolvedRole,
      status: redeemedSession.status,
      expires_at: redeemedSession.expiresAt.toISOString()
    });
  });
};
