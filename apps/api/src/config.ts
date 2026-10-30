import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(process.env.NODE_ENV === "production" ? 3000 : 4000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),

  // YouCam India endpoint
  YOUCAM_BASE_URL: z.string().url().default("https://yce-api-01.makeupar.com"),
  YOUCAM_API_KEY: z.string().optional().default(""),

  // Cryptographic Keys Separation
  // 1. AES-256-GCM encryption key for provider identifiers at rest (64 hex characters)
  PROVIDER_ID_ENCRYPTION_KEY: z.string().optional().default(""),
  // Backward compatibility alias for PROVIDER_ID_ENCRYPTION_KEY
  ENCRYPTION_KEY_HEX: z.string().optional().default(""),

  // 2. Cookie & session signing secret (64 hex characters)
  SESSION_COOKIE_SECRET: z.string().optional().default(""),

  // 3. HMAC-SHA256 deletion receipt signing key (64 hex characters)
  RECEIPT_SIGNING_KEY: z.string().optional().default(""),

  // Optional external Postgres; defaults to in-memory/file PGlite if omitted
  DATABASE_URL: z.string().optional().default(""),

  // Provider mode: LIVE_YOUCAM | RECORDED_LIVE_RESULT | DEMO_FIXTURE
  YOUCAM_PROVIDER_MODE: z.enum(["LIVE_YOUCAM", "RECORDED_LIVE_RESULT", "DEMO_FIXTURE"]).default("DEMO_FIXTURE"),

  // Rate limiting max requests per minute
  RATE_LIMIT_MAX: z.coerce.number().default(100)
});

export type Config = z.infer<typeof ConfigSchema>;

// Separate deterministic keys for development/test environments
const DEV_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const DEV_SESSION_SECRET = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const DEV_RECEIPT_KEY = "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff";

export function loadConfig(env = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    console.error("Configuration validation error:", result.error.format());
    throw new Error("Invalid application configuration");
  }

  const conf = result.data;

  // Resolve PROVIDER_ID_ENCRYPTION_KEY
  conf.PROVIDER_ID_ENCRYPTION_KEY =
    conf.PROVIDER_ID_ENCRYPTION_KEY || conf.ENCRYPTION_KEY_HEX || (conf.NODE_ENV === "production" ? "" : DEV_ENCRYPTION_KEY);
  conf.ENCRYPTION_KEY_HEX = conf.PROVIDER_ID_ENCRYPTION_KEY;

  // Resolve SESSION_COOKIE_SECRET
  conf.SESSION_COOKIE_SECRET =
    conf.SESSION_COOKIE_SECRET || (conf.NODE_ENV === "production" ? "" : DEV_SESSION_SECRET);

  // Resolve RECEIPT_SIGNING_KEY
  conf.RECEIPT_SIGNING_KEY =
    conf.RECEIPT_SIGNING_KEY || (conf.NODE_ENV === "production" ? "" : DEV_RECEIPT_KEY);

  // In production, require explicit, cryptographically valid 32-byte (64 hex chars) keys for each domain
  if (conf.NODE_ENV === "production") {
    const isHex64 = (k: string) => k && k.length === 64 && /^[0-9a-fA-F]{64}$/.test(k);

    if (!isHex64(conf.PROVIDER_ID_ENCRYPTION_KEY)) {
      throw new Error(
        "FATAL: PROVIDER_ID_ENCRYPTION_KEY (or ENCRYPTION_KEY_HEX) must be a 64-character hex string (32 bytes) in production. Refusing to start."
      );
    }
    if (!isHex64(conf.SESSION_COOKIE_SECRET)) {
      throw new Error(
        "FATAL: SESSION_COOKIE_SECRET must be a 64-character hex string (32 bytes) in production. Refusing to start."
      );
    }
    if (!isHex64(conf.RECEIPT_SIGNING_KEY)) {
      throw new Error(
        "FATAL: RECEIPT_SIGNING_KEY must be a 64-character hex string (32 bytes) in production. Refusing to start."
      );
    }
  }

  // If DATABASE_URL is a generic dummy placeholder or unconfigured, clear it so PGlite is used
  if (conf.DATABASE_URL.includes("localhost:5432") || conf.DATABASE_URL.includes("dbname")) {
    conf.DATABASE_URL = "";
  }

  // Only permit LIVE_YOUCAM if a genuine, non-placeholder API key is set
  if (conf.YOUCAM_API_KEY && conf.YOUCAM_API_KEY.trim().length > 15 && !conf.YOUCAM_API_KEY.includes("placeholder")) {
    if (env.YOUCAM_PROVIDER_MODE !== "DEMO_FIXTURE") {
      conf.YOUCAM_PROVIDER_MODE = "LIVE_YOUCAM";
    }
  } else {
    // If no valid key is set, fail-closed to DEMO_FIXTURE or RECORDED_LIVE_RESULT
    if (conf.YOUCAM_PROVIDER_MODE === "LIVE_YOUCAM") {
      conf.YOUCAM_PROVIDER_MODE = "DEMO_FIXTURE";
    }
  }

  return conf;
}

export const config = loadConfig();
