import type { FastifyPluginAsync } from "fastify";
import { eventBus, type SessionEvent } from "../services/event-bus.js";

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/events", async (req, reply) => {
    const query = req.query as { session_id?: string; role?: "wearer" | "helper" };
    if (!query.session_id) {
      return reply.status(400).send({ error: "MISSING_SESSION_ID" });
    }

    const sessionId = query.session_id;
    const role = query.role || "wearer";

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
