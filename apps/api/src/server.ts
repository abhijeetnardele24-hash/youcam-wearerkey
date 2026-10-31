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

  // Cookie Support for capability token bootstrap & session management
  // Registered upfront so req.cookies is reliably populated on all incoming hooks
  const cookieSecret = config.SESSION_COOKIE_SECRET || config.ENCRYPTION_KEY_HEX;
  await app.register(fastifyCookie, {
    secret: cookieSecret,
    parseOptions: {}
  });

  // Endpoint-specific sliding-window rate limiter per client IP + route scope
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000;
  const MAX_RATE_LIMIT_ENTRIES = 5000;

  function normalizeRoute(pathname: string): string {
    return pathname
      .replace(/\/api\/wearer\/proposals\/[^/]+/, "/api/wearer/proposals/:id")
      .replace(/\/api\/helper\/proposals\/[^/]+/, "/api/helper/proposals/:id")
      .replace(/\/api\/receipts\/[^/]+/, "/api/receipts/:id");
  }

  function getRouteLimit(normalizedPath: string): number {
    if (normalizedPath.startsWith("/api/auth/bootstrap")) return 30;
    if (normalizedPath === "/api/sessions") return 20;
    if (normalizedPath.includes("/generate")) return 15;
    if (normalizedPath.startsWith("/api/receipts/verify")) return 60;
    if (normalizedPath.includes("/retry-purge")) return 20;
    return config.RATE_LIMIT_MAX;
  }

  app.addHook("onRequest", async (req, reply) => {
    // In test mode, only enforce rate-limiting when explicitly requested by test suite
    const isTestRateLimitEnforced = req.headers["x-test-rate-limit"] === "true";
    if (config.NODE_ENV === "test" && !isTestRateLimitEnforced) return;

    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const pathname = req.url.split("?")[0];
    const normalizedPath = normalizeRoute(pathname);
    const key = `${ip}:${normalizedPath}`;
    const now = Date.now();

    // Bounded cleanup to prevent memory exhaustion DoS
    if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (now > v.resetAt) rateLimitMap.delete(k);
      }
      if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
        const iter = rateLimitMap.keys();
        for (let i = 0; i < 1000; i++) {
          const next = iter.next();
          if (next.done) break;
          rateLimitMap.delete(next.value);
        }
      }
    }

    const entry = rateLimitMap.get(key);
    const limit = isTestRateLimitEnforced ? 2 : getRouteLimit(normalizedPath);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else {
      entry.count += 1;
      if (entry.count > limit) {
        return reply.status(429).send({
          error: "TOO_MANY_REQUESTS",
          message: `Rate limit of ${limit} requests per minute exceeded for this endpoint. Please wait before retrying.`
        });
      }
    }
  });

  // Security Headers & Cache-Control No-Store
  app.addHook("onSend", async (req, reply) => {
    const isProd = config.NODE_ENV === "production";
    const csp = isProd
      ? "default-src 'self'; frame-ancestors 'self'; img-src 'self' data: blob: https:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; script-src 'self';"
      : "default-src 'self'; frame-ancestors 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; script-src 'self' 'unsafe-inline';";

    reply.header("Content-Security-Policy", csp);
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
      const isProd = config.NODE_ENV === "production";
      const origin = req.headers.origin;
      const referer = req.headers.referer;

      // In production, reject localhost / 127.0.0.1 origins
      const checkOriginString = (candidate: string) => {
        if (isProd) {
          return (
            candidate.startsWith("https://") &&
            (allowedOrigins.includes(candidate) || (config.APP_BASE_URL && candidate === config.APP_BASE_URL))
          );
        }
        return (
          allowedOrigins.includes(candidate) ||
          candidate.startsWith("http://localhost:") ||
          candidate.startsWith("http://127.0.0.1:") ||
          (config.APP_BASE_URL && candidate === config.APP_BASE_URL)
        );
      };

      if (origin) {
        if (!checkOriginString(origin)) {
          return reply.status(403).send({
            error: "CSRF_ORIGIN_DENIED",
            message: "Request origin not authorized by WearerKey security policy."
          });
        }
      } else if (referer) {
        try {
          const refOrigin = new URL(referer).origin;
          if (!checkOriginString(refOrigin)) {
            return reply.status(403).send({
              error: "CSRF_ORIGIN_DENIED",
              message: "Request referer not authorized by WearerKey security policy."
            });
          }
        } catch {
          return reply.status(403).send({
            error: "CSRF_ORIGIN_DENIED",
            message: "Malformed referer header."
          });
        }
      } else {
        // Missing Origin & Referer: allow only public creation routes or reject cookie-authenticated mutations
        const hasSessionCookie =
          req.cookies?.wearerkey_session_wearer ||
          req.cookies?.wearerkey_session_helper ||
          req.cookies?.wearerkey_session ||
          req.cookies?.wearerkey_purge_recovery;

        const isPublicS2S = req.url.startsWith("/api/sessions") || req.url.startsWith("/api/receipts/verify") || req.url.startsWith("/api/judge/seed");

        if (hasSessionCookie && !isPublicS2S && isProd) {
          return reply.status(403).send({
            error: "CSRF_ORIGIN_REQUIRED",
            message: "State-changing mutations with session credentials require valid Origin header."
          });
        }
      }
    }
  });


  // CORS: Explicit allowlist
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return cb(null, true);
      const isProd = config.NODE_ENV === "production";
      if (isProd) {
        if (
          origin.startsWith("https://") &&
          (allowedOrigins.includes(origin) || (config.APP_BASE_URL && origin === config.APP_BASE_URL))
        ) {
          return cb(null, true);
        }
        return cb(new Error("CORS origin not allowed in production"), false);
      }
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
      decorateReply: false
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

  // Centralized safe error handler: sanitize internal exceptions
  app.setErrorHandler((error: any, req, reply) => {
    req.log.error(error);
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      return reply.status(statusCode).send({
        error: "INTERNAL_SERVER_ERROR",
        message: "An internal server error occurred. Details have been logged securely."
      });
    }
    return reply.status(statusCode).send({
      error: error.code || "REQUEST_ERROR",
      message: error.message
    });
  });

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
