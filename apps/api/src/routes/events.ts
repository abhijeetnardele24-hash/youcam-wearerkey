import type { FastifyPluginAsync } from "fastify";
import { eq, or } from "drizzle-orm";
import { hashSessionToken, verifyTokenHash } from "@wearerkey/domain";
import { getDb } from "../db/index.js";
import { relaySessions } from "../db/schema.js";
import { eventBus, type SessionEvent } from "../services/event-bus.js";

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/events", async (req, reply) => {
    // 1. Extract session token strictly from role-isolated HttpOnly cookies
    let token: string | undefined;
    if (req.cookies) {
      token =
        req.cookies.wearerkey_session_wearer ||
        req.cookies.wearerkey_session_helper ||
        req.cookies.wearerkey_session;
    }

    if (!token) {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Authenticated HttpOnly session cookie required for event streaming. Query tokens and headers are rejected."
      });
    }

    const tokenHash = hashSessionToken(token);
    const db = await getDb();

    // Query session by matching wearer or helper session token hash
    const rows = await db
      .select()
      .from(relaySessions)
      .where(
        or(
          eq(relaySessions.wearerSessionTokenHash, tokenHash),
          eq(relaySessions.helperSessionTokenHash, tokenHash)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Invalid session credential."
      });
    }

    const session = rows[0];
    const isWearer =
      session.wearerSessionTokenHash && verifyTokenHash(tokenHash, session.wearerSessionTokenHash);
    const role: "wearer" | "helper" = isWearer ? "wearer" : "helper";
    const sessionId = session.id;

    if (session.status === "REVOKED") {
      return reply.status(410).send({
        error: "SESSION_REVOKED",
        message: "Session has been revoked."
      });
    }

    if (new Date() >= new Date(session.expiresAt) || session.status === "EXPIRED") {
      return reply.status(410).send({
        error: "SESSION_EXPIRED",
        message: "Session has expired."
      });
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");

    // Send initial connection handshake
    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({ sessionId, role, timestamp: new Date().toISOString() })}\n\n`
    );

    let isClosed = false;

    // Periodic heartbeat to detect dead sockets and maintain stream vitality (15s interval)
    const pingInterval = setInterval(() => {
      if (!isClosed) {
        reply.raw.write(`event: ping\ndata: {"time":${Date.now()}}\n\n`);
      }
    }, 15000);

    const unsubscribe = eventBus.subscribe(sessionId, (event: SessionEvent) => {
      if (isClosed) return;

      // Handle revocation or expiry: send terminal event and terminate stream
      if (event.type === "SESSION_REVOKED" || event.type === "SESSION_EXPIRED") {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
        isClosed = true;
        clearInterval(pingInterval);
        unsubscribe();
        reply.raw.end();
        return;
      }

      // Role filter: only deliver events targeted to 'all' or this specific role
      if (event.targetRole === "all" || event.targetRole === role) {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
      }
    });

    req.raw.on("close", () => {
      isClosed = true;
      clearInterval(pingInterval);
      unsubscribe();
    });
  });
};
