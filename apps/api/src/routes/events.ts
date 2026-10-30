import type { FastifyPluginAsync } from "fastify";
import { eq, or } from "drizzle-orm";
import { hashCapabilityToken } from "@wearerkey/domain";
import { getDb } from "../db/index.js";
import { relaySessions } from "../db/schema.js";
import { eventBus, type SessionEvent } from "../services/event-bus.js";

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/events", async (req, reply) => {
    // 1. Extract capability token strictly from Authorization header or HttpOnly session cookie
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.wearerkey_session) {
      token = req.cookies.wearerkey_session.trim();
    }

    if (!token) {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Capability token or authenticated session cookie required for event streaming"
      });
    }

    const tokenHash = hashCapabilityToken(token);
    const db = await getDb();

    // Query session by matching wearer or helper token hash
    const rows = await db
      .select()
      .from(relaySessions)
      .where(or(eq(relaySessions.wearerTokenHash, tokenHash), eq(relaySessions.helperTokenHash, tokenHash)))
      .limit(1);

    if (rows.length === 0) {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Invalid capability token"
      });
    }

    const session = rows[0];
    const isWearer = session.wearerTokenHash === tokenHash;
    const role: "wearer" | "helper" = isWearer ? "wearer" : "helper";
    const sessionId = session.id;

    if (session.status === "REVOKED") {
      return reply.status(403).send({
        error: "SESSION_REVOKED",
        message: "Session has been revoked"
      });
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");

    // Send initial handshake
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ sessionId, role, time: new Date() })}\n\n`);

    const unsubscribe = eventBus.subscribe(sessionId, (event: SessionEvent) => {
      // Role filter: only deliver events targeted to 'all' or this specific role
      if (event.targetRole === "all" || event.targetRole === role) {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
      }
    });

    req.raw.on("close", () => {
      unsubscribe();
    });
  });
};
