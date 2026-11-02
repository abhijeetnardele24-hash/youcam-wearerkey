import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";

// SHA-256 of the bundled synthetic demo sample (public/sample_vto_result.png)
export const BUNDLED_SYNTHETIC_SAMPLE_SHA256 = "57e17e1318b00264ca5538f7ff2ecffa6d1ea06ba73347d4c14c5ad8e5b89227";

export const RecordedResultManifestSchema = z.object({
  provenance: z.literal("CONFIRMED_PROVIDER_EXECUTION"),
  result_file: z.string().min(1),
  result_image_sha256: z.string().regex(/^[0-9a-f]{64}$/i, "result_image_sha256 must be a 64-char hex SHA-256"),
  live_receipt_file: z.string().min(1).default("docs/live-youcam-receipt.json"),
  task_id_hash: z.string().regex(/^[0-9a-f]{64}$/i, "task_id_hash must be a 64-char hex SHA-256"),
  evaluated_commit_sha: z.string().regex(/^[0-9a-f]{40}$/i, "evaluated_commit_sha must be a 40-char hex Git SHA"),
  timestamp: z.string().optional(),
  model_name: z.string().optional()
});

export type RecordedResultManifest = z.infer<typeof RecordedResultManifestSchema>;

export interface RecordedProvenanceCheckResult {
  valid: boolean;
  reason?: string;
  manifest?: RecordedResultManifest;
  resultFilePath?: string;
  resultUrl?: string;
}

export interface VerifyProvenanceOptions {
  rootDir?: string;
  manifestPath?: string;
}

/**
 * Validates whether recorded live result evidence satisfies the strict provenance requirements.
 * RECORDED_LIVE_RESULT is impossible unless:
 * 1. manifest exists;
 * 2. manifest schema validates;
 * 3. result file exists;
 * 4. result file is not the bundled synthetic sample;
 * 5. result file SHA-256 strictly matches manifest;
 * 6. referenced live receipt exists;
 * 7. receipt has live_execution_verified: true;
 * 8. receipt result hash matches served image;
 * 9. receipt evaluated SHA is valid and matches manifest;
 * 10. provider task hash exists and matches.
 */
export function verifyRecordedResultProvenance(options: VerifyProvenanceOptions = {}): RecordedProvenanceCheckResult {
  const rootDir = options.rootDir || path.resolve(process.cwd());
  const manifestPath = options.manifestPath || path.resolve(rootDir, "docs/recorded-result-manifest.json");

  // 1. Manifest must exist
  if (!fs.existsSync(manifestPath)) {
    return { valid: false, reason: `Recorded-result manifest not found at ${manifestPath}` };
  }

  // 2. Manifest schema must validate
  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (err: any) {
    return { valid: false, reason: `Malformed JSON in manifest: ${err.message}` };
  }

  const parseResult = RecordedResultManifestSchema.safeParse(manifestRaw);
  if (!parseResult.success) {
    return { valid: false, reason: `Manifest validation failed: ${parseResult.error.message}` };
  }
  const manifest = parseResult.data;

  // 3. Result file must exist
  const resultFilePath = path.isAbsolute(manifest.result_file)
    ? manifest.result_file
    : path.resolve(rootDir, manifest.result_file);

  if (!fs.existsSync(resultFilePath)) {
    return { valid: false, reason: `Result file not found at ${resultFilePath}` };
  }

  // 4. Must never be the bundled synthetic sample
  const baseName = path.basename(resultFilePath);
  if (baseName === "sample_vto_result.png") {
    return {
      valid: false,
      reason: "Forbidden: Bundled synthetic sample_vto_result.png cannot be served as verified recorded live result."
    };
  }

  const fileBytes = fs.readFileSync(resultFilePath);
  const actualFileSha256 = crypto.createHash("sha256").update(fileBytes).digest("hex");

  if (actualFileSha256.toLowerCase() === BUNDLED_SYNTHETIC_SAMPLE_SHA256.toLowerCase()) {
    return {
      valid: false,
      reason: "Forbidden: Result file content matches hash of bundled synthetic demo asset."
    };
  }

  // 5. Result file SHA-256 must match manifest
  if (actualFileSha256.toLowerCase() !== manifest.result_image_sha256.toLowerCase()) {
    return {
      valid: false,
      reason: `Result file SHA-256 mismatch: expected ${manifest.result_image_sha256}, got ${actualFileSha256}`
    };
  }

  // 6. Referenced live receipt exists
  const liveReceiptPath = path.isAbsolute(manifest.live_receipt_file)
    ? manifest.live_receipt_file
    : path.resolve(rootDir, manifest.live_receipt_file);

  if (!fs.existsSync(liveReceiptPath)) {
    return { valid: false, reason: `Referenced live receipt not found at ${liveReceiptPath}` };
  }

  // 7. Receipt must have live_execution_verified: true
  let receipt: any;
  try {
    receipt = JSON.parse(fs.readFileSync(liveReceiptPath, "utf-8"));
  } catch (err: any) {
    return { valid: false, reason: `Malformed JSON in live receipt: ${err.message}` };
  }

  if (receipt.live_execution_verified !== true) {
    return {
      valid: false,
      reason: `Live receipt does not have live_execution_verified=true (found ${receipt.live_execution_verified})`
    };
  }

  // 8. Receipt result hash matches the served image
  const receiptResultHash = receipt.result_image_sha256 || receipt.result_sha256 || receipt.image_hash;
  if (!receiptResultHash || receiptResultHash.toLowerCase() !== manifest.result_image_sha256.toLowerCase()) {
    return {
      valid: false,
      reason: `Receipt result hash does not match served image hash (${receiptResultHash} !== ${manifest.result_image_sha256})`
    };
  }

  // 9. Receipt evaluated SHA is valid and matches manifest
  if (!receipt.evaluated_commit_sha || !/^[0-9a-f]{40}$/i.test(receipt.evaluated_commit_sha)) {
    return {
      valid: false,
      reason: `Invalid evaluated_commit_sha in live receipt: ${receipt.evaluated_commit_sha}`
    };
  }
  if (receipt.evaluated_commit_sha.toLowerCase() !== manifest.evaluated_commit_sha.toLowerCase()) {
    return {
      valid: false,
      reason: `Evaluated commit SHA mismatch between receipt (${receipt.evaluated_commit_sha}) and manifest (${manifest.evaluated_commit_sha})`
    };
  }

  // 10. Provider task hash exists
  if (!manifest.task_id_hash || !/^[0-9a-f]{64}$/i.test(manifest.task_id_hash)) {
    return { valid: false, reason: "Provider task hash missing or invalid in manifest" };
  }
  if (receipt.task_id_hash && receipt.task_id_hash.toLowerCase() !== manifest.task_id_hash.toLowerCase()) {
    return {
      valid: false,
      reason: `Task ID hash mismatch between receipt (${receipt.task_id_hash}) and manifest (${manifest.task_id_hash})`
    };
  }

  // Generate safe result URL
  const normalizedFile = manifest.result_file.replace(/\\/g, "/");
  const resultUrl = normalizedFile.startsWith("public/")
    ? `/${normalizedFile.slice(7)}`
    : normalizedFile.startsWith("apps/api/public/")
      ? `/${normalizedFile.slice(16)}`
      : `/assets/${path.basename(normalizedFile)}`;

  return {
    valid: true,
    manifest,
    resultFilePath,
    resultUrl
  };
}
