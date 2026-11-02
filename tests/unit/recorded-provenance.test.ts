import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import {
  verifyRecordedResultProvenance,
  BUNDLED_SYNTHETIC_SAMPLE_SHA256,
  RecordedReceiptProvider
} from "../../apps/api/src/providers/youcam/index.js";

describe("Recorded-Result Provenance & Evidence Gate", () => {
  let tempDir: string;
  let docsDir: string;
  let publicDir: string;

  const validCommitSha = "4bf776f80d0d8bbec356d4b5b486940a4309c85b";
  const validTaskHash = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "provenance-test-"));
    docsDir = path.join(tempDir, "docs");
    publicDir = path.join(tempDir, "public");
    fs.mkdirSync(docsDir, { recursive: true });
    fs.mkdirSync(publicDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("fails closed when manifest file is absent", () => {
    const res = verifyRecordedResultProvenance({ rootDir: tempDir });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("manifest not found");
  });

  it("fails closed when manifest schema is invalid", () => {
    const manifestPath = path.join(docsDir, "recorded-result-manifest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        provenance: "INVALID_PROVENANCE_STRING",
        result_file: "test.png"
      })
    );

    const res = verifyRecordedResultProvenance({ rootDir: tempDir });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Manifest validation failed");
  });

  it("fails closed when result file is absent on disk", () => {
    const manifestPath = path.join(docsDir, "recorded-result-manifest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        provenance: "CONFIRMED_PROVIDER_EXECUTION",
        result_file: "public/non_existent.png",
        result_image_sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        task_id_hash: validTaskHash,
        evaluated_commit_sha: validCommitSha
      })
    );

    const res = verifyRecordedResultProvenance({ rootDir: tempDir });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Result file not found");
  });

  it("strictly rejects serving bundled synthetic sample_vto_result.png as recorded live result", () => {
    const manifestPath = path.join(docsDir, "recorded-result-manifest.json");
    const samplePath = path.join(publicDir, "sample_vto_result.png");
    fs.writeFileSync(samplePath, "fake-bytes");

    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        provenance: "CONFIRMED_PROVIDER_EXECUTION",
        result_file: "public/sample_vto_result.png",
        result_image_sha256: crypto.createHash("sha256").update("fake-bytes").digest("hex"),
        task_id_hash: validTaskHash,
        evaluated_commit_sha: validCommitSha
      })
    );

    const res = verifyRecordedResultProvenance({ rootDir: tempDir });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Forbidden: Bundled synthetic sample_vto_result.png cannot be served");
  });

  it("strictly rejects files whose SHA-256 matches the bundled synthetic sample even with a renamed filename", () => {
    const manifestPath = path.join(docsDir, "recorded-result-manifest.json");
    const disguisedPath = path.join(publicDir, "real_youcam_render_disguised.png");

    // Copy exact bytes of public/sample_vto_result.png from real repo
    const realSamplePath = path.resolve(process.cwd(), "apps/api/public/sample_vto_result.png");
    const syntheticBytes = fs.readFileSync(realSamplePath);
    fs.writeFileSync(disguisedPath, syntheticBytes);

    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        provenance: "CONFIRMED_PROVIDER_EXECUTION",
        result_file: "public/real_youcam_render_disguised.png",
        result_image_sha256: BUNDLED_SYNTHETIC_SAMPLE_SHA256,
        task_id_hash: validTaskHash,
        evaluated_commit_sha: validCommitSha
      })
    );

    const res = verifyRecordedResultProvenance({ rootDir: tempDir });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Forbidden: Result file content matches hash of bundled synthetic demo asset");
  });

  it("fails closed when result file SHA-256 does not match manifest", () => {
    const manifestPath = path.join(docsDir, "recorded-result-manifest.json");
    const imagePath = path.join(publicDir, "actual_vto.png");
    fs.writeFileSync(imagePath, "real-image-bytes");

    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        provenance: "CONFIRMED_PROVIDER_EXECUTION",
        result_file: "public/actual_vto.png",
        result_image_sha256: "0000000000000000000000000000000000000000000000000000000000000000",
        task_id_hash: validTaskHash,
        evaluated_commit_sha: validCommitSha
      })
    );

    const res = verifyRecordedResultProvenance({ rootDir: tempDir });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Result file SHA-256 mismatch");
  });

  it("fails closed when referenced live receipt is missing", () => {
    const manifestPath = path.join(docsDir, "recorded-result-manifest.json");
    const imagePath = path.join(publicDir, "actual_vto.png");
    const imgBytes = Buffer.from("genuine-youcam-v4-render-data");
    const hash = crypto.createHash("sha256").update(imgBytes).digest("hex");
    fs.writeFileSync(imagePath, imgBytes);

    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        provenance: "CONFIRMED_PROVIDER_EXECUTION",
        result_file: "public/actual_vto.png",
        result_image_sha256: hash,
        live_receipt_file: "docs/non_existent_receipt.json",
        task_id_hash: validTaskHash,
        evaluated_commit_sha: validCommitSha
      })
    );

    const res = verifyRecordedResultProvenance({ rootDir: tempDir });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Referenced live receipt not found");
  });

  it("fails closed when live receipt has live_execution_verified=false", () => {
    const manifestPath = path.join(docsDir, "recorded-result-manifest.json");
    const receiptPath = path.join(docsDir, "live-youcam-receipt.json");
    const imagePath = path.join(publicDir, "actual_vto.png");

    const imgBytes = Buffer.from("genuine-youcam-v4-render-data");
    const hash = crypto.createHash("sha256").update(imgBytes).digest("hex");
    fs.writeFileSync(imagePath, imgBytes);

    fs.writeFileSync(
      receiptPath,
      JSON.stringify({
        live_execution_verified: false,
        result_image_sha256: hash,
        evaluated_commit_sha: validCommitSha,
        task_id_hash: validTaskHash
      })
    );

    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        provenance: "CONFIRMED_PROVIDER_EXECUTION",
        result_file: "public/actual_vto.png",
        result_image_sha256: hash,
        live_receipt_file: "docs/live-youcam-receipt.json",
        task_id_hash: validTaskHash,
        evaluated_commit_sha: validCommitSha
      })
    );

    const res = verifyRecordedResultProvenance({ rootDir: tempDir });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("does not have live_execution_verified=true");
  });

  it("fails closed when live receipt result hash does not match served image", () => {
    const manifestPath = path.join(docsDir, "recorded-result-manifest.json");
    const receiptPath = path.join(docsDir, "live-youcam-receipt.json");
    const imagePath = path.join(publicDir, "actual_vto.png");

    const imgBytes = Buffer.from("genuine-youcam-v4-render-data");
    const hash = crypto.createHash("sha256").update(imgBytes).digest("hex");
    fs.writeFileSync(imagePath, imgBytes);

    fs.writeFileSync(
      receiptPath,
      JSON.stringify({
        live_execution_verified: true,
        result_image_sha256: "1111111111111111111111111111111111111111111111111111111111111111",
        evaluated_commit_sha: validCommitSha,
        task_id_hash: validTaskHash
      })
    );

    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        provenance: "CONFIRMED_PROVIDER_EXECUTION",
        result_file: "public/actual_vto.png",
        result_image_sha256: hash,
        live_receipt_file: "docs/live-youcam-receipt.json",
        task_id_hash: validTaskHash,
        evaluated_commit_sha: validCommitSha
      })
    );

    const res = verifyRecordedResultProvenance({ rootDir: tempDir });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Receipt result hash does not match served image hash");
  });

  it("accepts and verifies RECORDED_LIVE_RESULT when all criteria are genuinely satisfied", () => {
    const manifestPath = path.join(docsDir, "recorded-result-manifest.json");
    const receiptPath = path.join(docsDir, "live-youcam-receipt.json");
    const imagePath = path.join(publicDir, "actual_vto.png");

    const imgBytes = Buffer.from("genuine-youcam-v4-render-data");
    const hash = crypto.createHash("sha256").update(imgBytes).digest("hex");
    fs.writeFileSync(imagePath, imgBytes);

    fs.writeFileSync(
      receiptPath,
      JSON.stringify({
        live_execution_verified: true,
        result_image_sha256: hash,
        evaluated_commit_sha: validCommitSha,
        task_id_hash: validTaskHash
      })
    );

    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        provenance: "CONFIRMED_PROVIDER_EXECUTION",
        result_file: "public/actual_vto.png",
        result_image_sha256: hash,
        live_receipt_file: "docs/live-youcam-receipt.json",
        task_id_hash: validTaskHash,
        evaluated_commit_sha: validCommitSha
      })
    );

    const res = verifyRecordedResultProvenance({ rootDir: tempDir });
    expect(res.valid).toBe(true);
    expect(res.manifest?.provenance).toBe("CONFIRMED_PROVIDER_EXECUTION");
    expect(res.resultUrl).toBe("/actual_vto.png");

    // RecordedReceiptProvider initializes with RECORDED_LIVE_RESULT mode
    const provider = new RecordedReceiptProvider({ rootDir: tempDir, manifestPath });
    expect(provider.mode).toBe("RECORDED_LIVE_RESULT");
  });

  it("forces RecordedReceiptProvider into DEMO_FIXTURE when verification fails", () => {
    // Empty temp dir with no manifest
    const provider = new RecordedReceiptProvider({ rootDir: tempDir });
    expect(provider.mode).toBe("DEMO_FIXTURE");
    expect(provider.getProvenanceCheck().valid).toBe(false);
  });
});
