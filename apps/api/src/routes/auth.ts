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

    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);

    let resolvedRole: "wearer" | "helper" | null = null;
    let redeemedSession: typeof relaySessions.$inferSelect | null = null;

    // 1. Attempt atomic conditional redemption for Wearer bootstrap code
    const wearerUpdate = await db
      .update(relaySessions)
      .set({
        wearerBootstrapRedeemedAt: now,
        wearerSessionTokenHash: sessionTokenHash,
        updatedAt: now
      })
      .where(
        and(
          eq(relaySessions.wearerBootstrapCodeHash, candidateHash),
          isNull(relaySessions.wearerBootstrapRedeemedAt)
        )
      )
      .returning();

    if (wearerUpdate.length > 0) {
      resolvedRole = "wearer";
      redeemedSession = wearerUpdate[0];
    } else {
      // 2. Attempt atomic conditional redemption for Helper bootstrap code
      const helperUpdate = await db
        .update(relaySessions)
        .set({
          helperBootstrapRedeemedAt: now,
          helperSessionTokenHash: sessionTokenHash,
          updatedAt: now
        })
        .where(
          and(
            eq(relaySessions.helperBootstrapCodeHash, candidateHash),
            isNull(relaySessions.helperBootstrapRedeemedAt)
          )
        )
        .returning();

      if (helperUpdate.length > 0) {
        resolvedRole = "helper";
        redeemedSession = helperUpdate[0];
      }
    }

    // 3. If no row was conditionally updated, diagnose replay vs invalid code
    if (!redeemedSession || !resolvedRole) {
      // Check if code was already redeemed (replay attack prevention)
      const existingWearer = await db
        .select()
        .from(relaySessions)
        .where(eq(relaySessions.wearerBootstrapCodeHash, candidateHash))
        .limit(1);

      if (existingWearer.length > 0 && existingWearer[0].wearerBootstrapRedeemedAt !== null) {
        return reply.status(409).send({
          error: "BOOTSTRAP_CODE_ALREADY_USED",
          message: "This capability link has already been redeemed. Single-use bootstrap links cannot be replayed."
        });
      }

      const existingHelper = await db
        .select()
        .from(relaySessions)
        .where(eq(relaySessions.helperBootstrapCodeHash, candidateHash))
        .limit(1);

      if (existingHelper.length > 0 && existingHelper[0].helperBootstrapRedeemedAt !== null) {
        return reply.status(409).send({
          error: "BOOTSTRAP_CODE_ALREADY_USED",
          message: "This capability link has already been redeemed. Single-use bootstrap links cannot be replayed."
        });
      }

      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Invalid bootstrap code."
      });
    }

    // Role mismatch check if caller explicitly requested a specific role
    if (requestedRole && requestedRole !== resolvedRole) {
      return reply.status(403).send({
        error: "ROLE_MISMATCH",
        message: `Bootstrap code is authorized for ${resolvedRole}, not ${requestedRole}.`
      });
    }

    // Check revocation
    if (redeemedSession.status === "REVOKED") {
      return reply.status(410).send({
        error: "SESSION_REVOKED",
        message: "This Try-On Pass has been revoked by the wearer."
      });
    }

    // Check expiration
    if (new Date() >= new Date(redeemedSession.expiresAt) || redeemedSession.status === "EXPIRED") {
      return reply.status(410).send({
        error: "SESSION_EXPIRED",
        message: "This Try-On Pass has expired."
      });
    }

    // Set role-separated and standard secure HttpOnly session cookies
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
