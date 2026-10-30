import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import fs from "node:fs";
import url, { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { receiptRoutes } from "./routes/receipts.js";
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
      level: config.NODE_ENV === "test" ? "silent" : "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        'res.headers["set-cookie"]',
        "req.headers['x-capability-token']",
        "req.headers['x-purge-recovery-token']",
        "req.headers['x-session-token']",
        "req.query.token",
        "req.body.bootstrap_code",
        "req.body.session_token",
        "req.body.token",
        "req.body.wearer_token",
        "req.body.helper_token",
        "req.body.purge_recovery_token"
      ]
    }
  });

  // In-memory sliding-window rate limiter per client IP
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000;

  app.addHook("onRequest", async (req, reply) => {
    // Skip rate limiting during internal test runs
    if (config.NODE_ENV === "test") return;

    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else {
      entry.count += 1;
      if (entry.count > config.RATE_LIMIT_MAX) {
        return reply.status(429).send({
          error: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Please wait a minute before retrying."
        });
      }
    }
  });

  // Security Headers & Cache-Control No-Store
  app.addHook("onSend", async (req, reply) => {
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; frame-ancestors 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; script-src 'self' 'unsafe-inline';"
    );
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "SAMEORIGIN");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    // Enforce private no-store headers on all API responses
    if (req.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      reply.header("Pragma", "no-cache");
      reply.header("Expires", "0");
    }
  });

  // CSRF Origin validation on state-changing requests
  const allowedOrigins = config.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  app.addHook("onRequest", async (req, reply) => {
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin) {
        const isAllowed =
          allowedOrigins.includes(origin) ||
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:") ||
          (config.APP_BASE_URL && origin === config.APP_BASE_URL);

        if (!isAllowed) {
          return reply.status(403).send({
            error: "CSRF_ORIGIN_DENIED",
            message: "Request origin not authorized by WearerKey security policy."
          });
        }
      }
    }
  });

  // Cookie Support for capability token bootstrap & session management
  const cookieSecret = config.SESSION_COOKIE_SECRET || config.ENCRYPTION_KEY_HEX;
  await app.register(fastifyCookie, {
    secret: cookieSecret,
    parseOptions: {}
  });

  // CORS: Explicit allowlist
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return cb(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:") ||
        (config.APP_BASE_URL && origin === config.APP_BASE_URL)
      ) {
        return cb(null, true);
      }
      return cb(new Error("CORS origin not allowed by WearerKey security policy"), false);
    },
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

  // Serve static demo assets if directory exists
  const publicDir = path.resolve(__dirname, "../public");
  if (fs.existsSync(publicDir)) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: "/assets/",
      decorateReply: true
    });
  }

  // Register API Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(receiptRoutes);
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
      wildcard: false,
      decorateReply: false // Already decorated by public assets if present
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

function isDirectExecution(): boolean {
  if (process.env.NODE_ENV === "test") return false;
  const scriptPath = process.argv[1];
  if (!scriptPath) return false;
  try {
    const scriptUrl = url.pathToFileURL(path.resolve(scriptPath)).href;
    return import.meta.url === scriptUrl || scriptPath.endsWith("server.ts") || scriptPath.endsWith("server.js");
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  start();
}
