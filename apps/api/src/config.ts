import { z } from "zod";
import crypto from "node:crypto";

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(process.env.NODE_ENV === "production" ? 3000 : 4000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),

  // YouCam India endpoint
  YOUCAM_BASE_URL: z.string().url().default("https://yce-api-01.makeupar.com"),
  YOUCAM_API_KEY: z.string().optional().default(""),

  // AES-256-GCM encryption key for provider identifiers at rest (64 hex characters)
  ENCRYPTION_KEY_HEX: z.string().optional().default(""),

  // Optional external Postgres; defaults to in-memory/file PGlite if omitted
  DATABASE_URL: z.string().optional().default(""),

  // Provider mode: LIVE_YOUCAM | RECORDED_LIVE_RESULT | DEMO_FIXTURE
  YOUCAM_PROVIDER_MODE: z.enum(["LIVE_YOUCAM", "RECORDED_LIVE_RESULT", "DEMO_FIXTURE"]).default("DEMO_FIXTURE")
});

export type Config = z.infer<typeof ConfigSchema>;

// Dedicated in-memory fallback key for non-production environments
const DEV_TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export function loadConfig(env = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    console.error("Configuration validation error:", result.error.format());
    throw new Error("Invalid application configuration");
  }

  const conf = result.data;

  // In production, require an explicit, cryptographically valid 32-byte (64 hex chars) key
  if (conf.NODE_ENV === "production") {
    if (!conf.ENCRYPTION_KEY_HEX || conf.ENCRYPTION_KEY_HEX.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(conf.ENCRYPTION_KEY_HEX)) {
      throw new Error(
        "FATAL: ENCRYPTION_KEY_HEX must be a 64-character hex string (32 bytes) in production environment. Refusing to start."
      );
    }
  } else {
    // In dev/test, if not provided, use an explicit test key or generate one
    if (!conf.ENCRYPTION_KEY_HEX || conf.ENCRYPTION_KEY_HEX.length !== 64) {
      conf.ENCRYPTION_KEY_HEX = DEV_TEST_KEY;
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
