import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { sessionRoutes } from "./routes/sessions.js";
import { wearerRoutes } from "./routes/wearer.js";
import { helperRoutes } from "./routes/helper.js";
import { eventRoutes } from "./routes/events.js";
import { judgeRoutes } from "./routes/judge.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info"
    }
  });

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  });

  // Multipart upload support (10MB limit)
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1
    }
  });

  // Register API Routes first
  await app.register(healthRoutes);
  await app.register(sessionRoutes);
  await app.register(wearerRoutes);
  await app.register(helperRoutes);
  await app.register(eventRoutes);
  await app.register(judgeRoutes);

  // Serve Built Web Frontend (SPA) if present
  const webDistDir = path.resolve(__dirname, "../../web/dist");
  if (fs.existsSync(webDistDir)) {
    await app.register(fastifyStatic, {
      root: webDistDir,
      prefix: "/",
      wildcard: false
    });

    // SPA fallback: return index.html for non-API GET requests
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api/")) {
        const indexPath = path.join(webDistDir, "index.html");
        if (fs.existsSync(indexPath)) {
          return reply.type("text/html").send(fs.readFileSync(indexPath));
        }
      }
      return reply.status(404).send({ error: "NOT_FOUND", message: "Resource not found" });
    });
  }

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`🚀 WearerKey unified server running at http://${config.HOST}:${config.PORT}`);
    console.log(`   Provider Mode: ${config.YOUCAM_PROVIDER_MODE}`);
    console.log(`   YouCam Host: ${config.YOUCAM_BASE_URL}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test" && import.meta.url.endsWith(process.argv[1] || "")) {
  start();
}
