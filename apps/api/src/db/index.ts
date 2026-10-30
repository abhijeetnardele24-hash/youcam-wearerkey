import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

export type DbClient = ReturnType<typeof drizzlePg> | ReturnType<typeof drizzlePglite>;

let dbInstance: DbClient | null = null;
let pgliteInstance: PGlite | null = null;

export async function getDb(): Promise<DbClient> {
  if (dbInstance) {
    return dbInstance;
  }

  if (config.NODE_ENV !== "test" && config.DATABASE_URL && config.DATABASE_URL.startsWith("postgres")) {
    const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
    dbInstance = drizzlePg(pool, { schema });
    return dbInstance;
  }

  // Fallback to embedded in-memory/file PGlite
  pgliteInstance = new PGlite();
  dbInstance = drizzlePglite(pgliteInstance, { schema });

  // Initialize schema tables automatically in PGlite
  await initSchema(pgliteInstance);

  return dbInstance;
}

async function initSchema(pglite: PGlite) {
  const ddl = `
    CREATE TABLE IF NOT EXISTS relay_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      wearer_bootstrap_code_hash VARCHAR(64),
      wearer_bootstrap_redeemed_at TIMESTAMPTZ,
      helper_bootstrap_code_hash VARCHAR(64),
      helper_bootstrap_redeemed_at TIMESTAMPTZ,
      wearer_session_token_hash VARCHAR(64),
      helper_session_token_hash VARCHAR(64),
      wearer_token_hash VARCHAR(64) NOT NULL,
      helper_token_hash VARCHAR(64) NOT NULL,
      purge_recovery_token_hash VARCHAR(64),
      purge_recovery_expires_at TIMESTAMPTZ,
      consent_version VARCHAR(32) NOT NULL DEFAULT '2026-10-30-v1',
      allowed_categories JSONB NOT NULL,
      max_proposals INTEGER NOT NULL DEFAULT 3,
      expires_at TIMESTAMPTZ NOT NULL,
      gift_mode BOOLEAN NOT NULL DEFAULT FALSE,
      source_file_id_ciphertext TEXT,
      source_content_hash VARCHAR(64),
      deletion_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUESTED',
      source_deletion_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUESTED',
      deletion_error TEXT,
      deletion_errors JSONB,
      signed_receipt_json TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      purged_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES relay_sessions(id) ON DELETE CASCADE,
      label VARCHAR(128) NOT NULL,
      garment_category VARCHAR(32) NOT NULL,
      price_minor INTEGER,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      product_url TEXT,
      brand VARCHAR(128),
      garment_file_id_ciphertext TEXT,
      garment_content_hash VARCHAR(64),
      idempotency_fingerprint VARCHAR(64) UNIQUE,
      status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
      garment_deletion_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUESTED',
      failure_code VARCHAR(64),
      failure_message_safe TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS provider_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      provider VARCHAR(32) NOT NULL DEFAULT 'YOUCAM',
      mode VARCHAR(32) NOT NULL,
      api_family VARCHAR(32) NOT NULL DEFAULT 'AI_CLOTHES_V4',
      task_id_ciphertext TEXT,
      result_url_ciphertext TEXT,
      estimated_units INTEGER NOT NULL DEFAULT 2,
      observed_units INTEGER,
      provider_status VARCHAR(32),
      provider_error_code VARCHAR(64),
      task_deletion_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUESTED',
      deletion_requested_at TIMESTAMPTZ,
      deletion_confirmed_at TIMESTAMPTZ,
      receipt_sha256 VARCHAR(64),
      evaluated_commit_sha VARCHAR(40),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS decisions (
      proposal_id UUID PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
      decision VARCHAR(16) NOT NULL,
      note TEXT,
      decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id SERIAL PRIMARY KEY,
      session_id UUID,
      actor_role VARCHAR(16) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      details JSONB,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await pglite.exec(ddl);
}

export async function resetDbForTesting(): Promise<void> {
  if (pgliteInstance) {
    await pgliteInstance.exec(`
      DROP TABLE IF EXISTS audit_events CASCADE;
      DROP TABLE IF EXISTS decisions CASCADE;
      DROP TABLE IF EXISTS provider_tasks CASCADE;
      DROP TABLE IF EXISTS proposals CASCADE;
      DROP TABLE IF EXISTS relay_sessions CASCADE;
    `);
    await initSchema(pgliteInstance);
  }
}
