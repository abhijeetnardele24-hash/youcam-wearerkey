import type { FastifyPluginAsync } from "fastify";
import { eq, or } from "drizzle-orm";
import { hashCapabilityToken, verifyTokenHash } from "@wearerkey/domain";
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

    const { token, role: requestedRole } = parseResult.data;
    const tokenHash = hashCapabilityToken(token);
    const db = await getDb();

    // Query session matching wearer or helper token hash
    const rows = await db
      .select()
      .from(relaySessions)
      .where(or(eq(relaySessions.wearerTokenHash, tokenHash), eq(relaySessions.helperTokenHash, tokenHash)))
      .limit(1);

    const session = rows[0];
    if (!session) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Invalid capability token."
      });
    }

    const isWearer = verifyTokenHash(tokenHash, session.wearerTokenHash);
    const isHelper = verifyTokenHash(tokenHash, session.helperTokenHash);

    if (!isWearer && !isHelper) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Capability token hash mismatch."
      });
    }

    const resolvedRole: "wearer" | "helper" = isWearer ? "wearer" : "helper";

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

    // Set secure HttpOnly session cookie so tokens never live in browser address bars or query strings
    reply.setCookie("wearerkey_session", token, {
      path: "/api",
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.max(60, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000))
    });

    await db.insert(auditEvents).values({
      sessionId: session.id,
      actorRole: resolvedRole,
      eventType: "SESSION_BOOTSTRAPPED",
      details: { role: resolvedRole }
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
