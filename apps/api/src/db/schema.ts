import { pgTable, text, varchar, timestamp, integer, boolean, json, uuid, serial } from "drizzle-orm/pg-core";

export const relaySessions = pgTable("relay_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
  wearerTokenHash: varchar("wearer_token_hash", { length: 64 }).notNull(),
  helperTokenHash: varchar("helper_token_hash", { length: 64 }).notNull(),
  consentVersion: varchar("consent_version", { length: 32 }).notNull().default("2026-10-30-v1"),
  allowedCategories: json("allowed_categories").$type<string[]>().notNull(),
  maxProposals: integer("max_proposals").notNull().default(3),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  giftMode: boolean("gift_mode").notNull().default(false),
  sourceFileIdCiphertext: text("source_file_id_ciphertext"),
  sourceContentHash: varchar("source_content_hash", { length: 64 }),
  deletionStatus: varchar("deletion_status", { length: 32 }).notNull().default("NOT_REQUESTED"),
  sourceDeletionStatus: varchar("source_deletion_status", { length: 32 }).notNull().default("NOT_REQUESTED"),
  deletionError: text("deletion_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  purgedAt: timestamp("purged_at", { withTimezone: true })
});

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => relaySessions.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 128 }).notNull(),
  garmentCategory: varchar("garment_category", { length: 32 }).notNull(),
  priceMinor: integer("price_minor"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  productUrl: text("product_url"),
  brand: varchar("brand", { length: 128 }),
  garmentFileIdCiphertext: text("garment_file_id_ciphertext"),
  garmentContentHash: varchar("garment_content_hash", { length: 64 }),
  idempotencyFingerprint: varchar("idempotency_fingerprint", { length: 64 }).unique(),
  status: varchar("status", { length: 32 }).notNull().default("CREATED"),
  garmentDeletionStatus: varchar("garment_deletion_status", { length: 32 }).notNull().default("NOT_REQUESTED"),
  failureCode: varchar("failure_code", { length: 64 }),
  failureMessageSafe: text("failure_message_safe"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true })
});

export const providerTasks = pgTable("provider_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 32 }).notNull().default("YOUCAM"),
  mode: varchar("mode", { length: 32 }).notNull(),
  apiFamily: varchar("api_family", { length: 32 }).notNull().default("AI_CLOTHES_V4"),
  taskIdCiphertext: text("task_id_ciphertext"),
  resultUrlCiphertext: text("result_url_ciphertext"),
  estimatedUnits: integer("estimated_units").notNull().default(2),
  observedUnits: integer("observed_units"),
  providerStatus: varchar("provider_status", { length: 32 }),
  providerErrorCode: varchar("provider_error_code", { length: 64 }),
  taskDeletionStatus: varchar("task_deletion_status", { length: 32 }).notNull().default("NOT_REQUESTED"),
  deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
  deletionConfirmedAt: timestamp("deletion_confirmed_at", { withTimezone: true }),
  receiptSha256: varchar("receipt_sha256", { length: 64 }),
  evaluatedCommitSha: varchar("evaluated_commit_sha", { length: 40 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true })
});

export const decisions = pgTable("decisions", {
  proposalId: uuid("proposal_id").primaryKey().references(() => proposals.id, { onDelete: "cascade" }),
  decision: varchar("decision", { length: 16 }).notNull(), // APPROVE | MAYBE | PASS
  note: text("note"),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow()
});

export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  sessionId: uuid("session_id"),
  actorRole: varchar("actor_role", { length: 16 }).notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  details: json("details"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow()
});
