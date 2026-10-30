import { z } from "zod";

// --- Enums & Primitives ---

export const GarmentCategorySchema = z.enum([
  "upper_body",
  "lower_body",
  "full_body",
  "outer",
  "shoes",
  "auto"
]);
export type GarmentCategory = z.infer<typeof GarmentCategorySchema>;

export const ProposalStatusSchema = z.enum([
  "CREATED",
  "READY",
  "UPLOADING",
  "SUBMITTED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "REJECTED_CONSENT",
  "REVIEWED"
]);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const DecisionSchema = z.enum(["APPROVE", "MAYBE", "PASS"]);
export type Decision = z.infer<typeof DecisionSchema>;

export const SessionStatusSchema = z.enum([
  "DRAFT",
  "READY",
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
  "COMPLETED",
  "PURGED"
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const DeletionStatusSchema = z.enum([
  "NOT_REQUESTED",
  "REQUESTED",
  "CONFIRMED",
  "PARTIAL_FAILURE",
  "FAILED"
]);
export type DeletionStatus = z.infer<typeof DeletionStatusSchema>;

export const ProviderModeSchema = z.enum([
  "LIVE_YOUCAM",
  "RECORDED_LIVE_RESULT",
  "DEMO_FIXTURE"
]);
export type ProviderMode = z.infer<typeof ProviderModeSchema>;

// --- Session Lifecycle Schemas ---

export const CreateSessionRequestSchema = z.object({
  allowed_categories: z.array(GarmentCategorySchema).min(1, "Select at least one permitted garment category"),
  max_proposals: z.number().int().min(1).max(10).default(3),
  expires_in_hours: z.number().int().min(1).max(24).default(1),
  gift_mode: z.boolean().default(false),
  consent_version: z.string().min(1).default("2026-10-30-v1")
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const CreateSessionResponseSchema = z.object({
  session_id: z.string().uuid(),
  wearer_token: z.string().min(32),
  wearer_url: z.string().url(),
  expires_at: z.string().datetime(),
  status: SessionStatusSchema
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;

export const MintHelperLinkResponseSchema = z.object({
  helper_token: z.string().min(32),
  helper_url: z.string().url(),
  expires_at: z.string().datetime()
});
export type MintHelperLinkResponse = z.infer<typeof MintHelperLinkResponseSchema>;

// --- Authentication & Single-Use Bootstrap ---

export const BootstrapRequestSchema = z.object({
  token: z.string().min(16),
  role: z.enum(["wearer", "helper"]).optional()
});
export type BootstrapRequest = z.infer<typeof BootstrapRequestSchema>;

export const BootstrapResponseSchema = z.object({
  authenticated: z.boolean(),
  session_id: z.string().uuid(),
  role: z.enum(["wearer", "helper"]),
  status: SessionStatusSchema,
  expires_at: z.string().datetime()
});
export type BootstrapResponse = z.infer<typeof BootstrapResponseSchema>;

// --- Proposal Submissions ---

export const SubmitProposalRequestSchema = z.object({
  label: z.string().min(1).max(100),
  garment_category: GarmentCategorySchema,
  price_minor: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).default("USD"),
  product_url: z.string().url().max(1000).optional(),
  brand: z.string().max(100).optional()
});
export type SubmitProposalRequest = z.infer<typeof SubmitProposalRequestSchema>;

// --- Wearer Decisions ---

export const SubmitDecisionRequestSchema = z.object({
  decision: DecisionSchema,
  note: z.string().max(140).optional()
});
export type SubmitDecisionRequest = z.infer<typeof SubmitDecisionRequestSchema>;

// --- Role-Safe DTOs ---

export const WearerProposalDTOSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  garment_category: GarmentCategorySchema,
  price_minor: z.number().int().nullable().optional(),
  currency: z.string(),
  product_url: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  status: ProposalStatusSchema,
  decision: DecisionSchema.nullable().optional(),
  wearer_note: z.string().nullable().optional(),
  has_result: z.boolean(),
  result_stream_url: z.string().nullable().optional(),
  garment_preview_url: z.string().nullable().optional(),
  failure_code: z.string().nullable().optional(),
  failure_message_safe: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().optional()
});
export type WearerProposalDTO = z.infer<typeof WearerProposalDTOSchema>;

export const HelperProposalDTOSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  garment_category: GarmentCategorySchema,
  price_minor: z.number().int().nullable().optional(),
  currency: z.string(),
  product_url: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  status: ProposalStatusSchema,
  decision: DecisionSchema.nullable().optional(),
  wearer_note: z.string().nullable().optional(),
  garment_preview_url: z.string().nullable().optional(),
  failure_code: z.string().nullable().optional(),
  failure_message_safe: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().optional()
  // CRITICAL PRIVACY INVARIANT: result_stream_url, source image, and result image NEVER appear here!
});
export type HelperProposalDTO = z.infer<typeof HelperProposalDTOSchema>;

export const WearerSessionDTOSchema = z.object({
  id: z.string().uuid(),
  status: SessionStatusSchema,
  consent_version: z.string(),
  allowed_categories: z.array(GarmentCategorySchema),
  max_proposals: z.number().int(),
  proposals_count: z.number().int(),
  proposals_remaining: z.number().int(),
  expires_at: z.string().datetime(),
  gift_mode: z.boolean(),
  source_uploaded: z.boolean(),
  source_image_url: z.string().nullable().optional(),
  helper_link_minted: z.boolean(),
  created_at: z.string().datetime(),
  proposals: z.array(WearerProposalDTOSchema)
});
export type WearerSessionDTO = z.infer<typeof WearerSessionDTOSchema>;

export const HelperSessionDTOSchema = z.object({
  id: z.string().uuid(),
  status: SessionStatusSchema,
  allowed_categories: z.array(GarmentCategorySchema),
  max_proposals: z.number().int(),
  proposals_remaining: z.number().int(),
  expires_at: z.string().datetime(),
  gift_mode: z.boolean(),
  wearer_photo_status: z.literal("PROTECTED_NOT_SHARED"),
  created_at: z.string().datetime(),
  proposals: z.array(HelperProposalDTOSchema)
});
export type HelperSessionDTO = z.infer<typeof HelperSessionDTOSchema>;

// --- Consent Gate ---

export const ConsentGateCodeSchema = z.enum([
  "OK",
  "SESSION_INACTIVE",
  "SESSION_EXPIRED",
  "CATEGORY_NOT_ALLOWED",
  "CAP_EXCEEDED",
  "DUPLICATE_PROPOSAL",
  "INVALID_SOURCE_IMAGE",
  "INVALID_GARMENT_IMAGE",
  "BUDGET_EXHAUSTED",
  "PROVIDER_NOT_CONFIGURED"
]);
export type ConsentGateCode = z.infer<typeof ConsentGateCodeSchema>;

export const ConsentGateResultSchema = z.object({
  allowed: z.boolean(),
  code: ConsentGateCodeSchema,
  reason: z.string()
});
export type ConsentGateResult = z.infer<typeof ConsentGateResultSchema>;

// --- System Health & Meta ---

export const HealthCheckResponseSchema = z.object({
  status: z.literal("ok"),
  app: z.string(),
  version: z.string(),
  commit: z.string(),
  environment: z.string(),
  provider_mode: ProviderModeSchema,
  database: z.enum(["connected", "disconnected", "embedded"]),
  timestamp: z.string().datetime()
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export const MetaResponseSchema = z.object({
  app: z.string(),
  version: z.string(),
  commit: z.string(),
  provider_mode: ProviderModeSchema,
  api_host: z.string(),
  supported_categories: z.array(GarmentCategorySchema),
  max_proposals_limit: z.number().int(),
  features: z.object({
    gift_mode: z.boolean(),
    deletion_receipts: z.boolean(),
    judge_tour: z.boolean(),
    sse_updates: z.boolean()
  }),
  safety_disclaimer: z.string()
});
export type MetaResponse = z.infer<typeof MetaResponseSchema>;

// --- Deletion & Privacy Receipt ---

export const ReceiptHmacSchema = z.object({
  key_id: z.string(),
  algorithm: z.literal("HMAC-SHA256"),
  signature: z.string(),
  signed_at: z.string().datetime()
});
export type ReceiptHmac = z.infer<typeof ReceiptHmacSchema>;

export const DeletionReceiptSchema = z.object({
  schema_version: z.string().default("2.0"),
  session_id: z.string().uuid(),
  revoked_at: z.string().datetime().nullable(),
  purged_at: z.string().datetime().nullable(), // Strictly null if any remote deletion unconfirmed
  overall_deletion_status: DeletionStatusSchema,
  task_deletion_status: DeletionStatusSchema,
  source_file_deletion_status: DeletionStatusSchema,
  garment_file_deletion_status: DeletionStatusSchema,
  provider_tasks_total: z.number().int(),
  provider_tasks_deleted: z.number().int(),
  remote_files_total: z.number().int(),
  remote_files_deleted: z.number().int(),
  in_memory_buffers_purged: z.boolean(),
  local_access_revoked: z.boolean(),
  evaluated_commit_sha: z.string(),
  evidence_authority: z.string(),
  deletion_error: z.string().nullable().optional(),
  receipt_hmac: ReceiptHmacSchema.optional()
});
export type DeletionReceipt = z.infer<typeof DeletionReceiptSchema>;

export const ReceiptVerificationRequestSchema = z.object({
  receipt: z.record(z.any()),
  signature: z.string(),
  signed_at: z.string().datetime(),
  key_id: z.string().optional()
});
export type ReceiptVerificationRequest = z.infer<typeof ReceiptVerificationRequestSchema>;

export const ReceiptVerificationResponseSchema = z.object({
  valid: z.boolean(),
  key_id: z.string(),
  algorithm: z.string(),
  evaluated_commit_sha: z.string().optional(),
  overall_deletion_status: z.string().optional()
});
export type ReceiptVerificationResponse = z.infer<typeof ReceiptVerificationResponseSchema>;
