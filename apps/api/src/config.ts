import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  // YouCam India endpoint
  YOUCAM_BASE_URL: z.string().url().default("https://yce-api-01.makeupar.com"),
  YOUCAM_API_KEY: z.string().optional().default(""),

  // AES-256-GCM encryption key for provider identifiers at rest (64 hex characters)
  ENCRYPTION_KEY_HEX: z.string().default("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),

  // Optional external Postgres; defaults to in-memory/file PGlite if omitted
  DATABASE_URL: z.string().optional().default(""),

  // Provider mode: LIVE_YOUCAM | RECORDED_LIVE_RESULT | DEMO_FIXTURE
  YOUCAM_PROVIDER_MODE: z.enum(["LIVE_YOUCAM", "RECORDED_LIVE_RESULT", "DEMO_FIXTURE"]).default("DEMO_FIXTURE")
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    console.error("Configuration validation error:", result.error.format());
    throw new Error("Invalid application configuration");
  }

  // If YOUCAM_API_KEY is present and not empty, allow LIVE_YOUCAM mode
  const conf = result.data;
  // If DATABASE_URL is a generic dummy placeholder or unconfigured, clear it so PGlite is used
  if (conf.DATABASE_URL.includes("localhost:5432") || conf.DATABASE_URL.includes("dbname")) {
    conf.DATABASE_URL = "";
  }
  if (conf.YOUCAM_API_KEY && conf.YOUCAM_API_KEY.trim().length > 10) {
    if (env.YOUCAM_PROVIDER_MODE !== "DEMO_FIXTURE") {
      conf.YOUCAM_PROVIDER_MODE = "LIVE_YOUCAM";
    }
  }

  return conf;
}

export const config = loadConfig();
