import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { YouCamClothesProvider } from "../apps/api/src/providers/youcam/youcam-provider.js";
import type { SanitizedImage } from "../apps/api/src/services/image-sanitizer.js";
import { calculateContentHash } from "../packages/domain/src/crypto.js";

/**
 * Pure-JavaScript fast parser for PNG and JPEG headers.
 * Avoids native C++ sharp dependency issues in scripts across diverse runner environments.
 */
export function parseImageDimensions(buffer: Buffer): { format: "png" | "jpeg"; width: number; height: number } | null {
  if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return {
      format: "png",
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          format: "jpeg",
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7)
        };
      }
      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    }
  }
  return null;
}

export interface DeletionVerificationRecord {
  task_deletion: "CONFIRMED" | "FAILED" | "NOT_REQUESTED";
  source_deletion: "CONFIRMED" | "FAILED" | "NOT_REQUESTED";
  garment_deletion: "CONFIRMED" | "FAILED" | "NOT_REQUESTED";
  all_deletions_confirmed: boolean;
}

export interface FixtureProvenanceRecord {
  person_fixture_type: "USER_PROVIDED_PHOTOGRAPH" | "SYNTHETIC_DEMO_ILLUSTRATION" | "UNVERIFIED";
  garment_fixture_type: "USER_PROVIDED_PHOTOGRAPH" | "SYNTHETIC_DEMO_ILLUSTRATION" | "UNVERIFIED";
  authority: "USER_SUPPLIED_PROVENANCE_NOT_INDEPENDENTLY_VERIFIED";
  license_or_provenance: string;
  person_sha256?: string;
  garment_sha256?: string;
  manifest_verified: boolean;
}

export interface SmokeReceipt {
  evaluated_commit_sha: string;
  provider_mode: "LIVE_YOUCAM" | "DEMO_FIXTURE" | "RECORDED_LIVE_RESULT";
  endpoint: string;
  timestamp: string;
  connectivity_status: "CONNECTED" | "BLOCKED_MISSING_KEY" | "AUTH_FAILED" | "FIXTURE_REJECTED" | "OFFLINE" | "TIMEOUT";
  http_status: number;
  live_execution_verified: boolean;
  generation_verified: boolean;
  deletion_verified: boolean;
  model_name: string;
  api_family: string;
  latency_ms?: number;
  task_id_hash?: string;
  deletion_breakdown?: DeletionVerificationRecord;
  fixture_provenance?: FixtureProvenanceRecord;
  reason?: string;
  error?: string;
}

export function getCommitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return process.env.GIT_COMMIT_SHA || "UNKNOWN_COMMIT";
  }
}

export interface FixtureValidationResult {
  valid: boolean;
  error?: string;
  manifest?: any;
  sha256?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  buffer?: Buffer;
}

/**
 * Validates that an image fixture is an authentic, photographic raster image
 * accompanied by a matching .provenance.json manifest. Rejects synthetic SVGs,
 * placeholders, or corrupted/mismatched files.
 */
export async function validateFixture(fixturePath: string): Promise<FixtureValidationResult> {
  if (!fixturePath || !fs.existsSync(fixturePath)) {
    return { valid: false, error: `Fixture file does not exist: ${fixturePath}` };
  }

  const ext = path.extname(fixturePath).toLowerCase();
  if (ext === ".svg") {
    return { valid: false, error: "Synthetic SVGs and vector silhouettes are strictly rejected." };
  }

  const buffer = fs.readFileSync(fixturePath);
  if (buffer.length < 10000) {
    return { valid: false, error: `Fixture too small (${buffer.length} bytes). Minimum photographic raster size is 10KB.` };
  }

  // Verify raster format & dimensions
  const parsed = parseImageDimensions(buffer);
  if (!parsed) {
    return { valid: false, error: "Failed to decode image raster. Must be valid PNG or JPEG." };
  }

  const { width, height, format } = parsed;
  if (width < 400 || height < 400) {
    return { valid: false, error: `Fixture dimensions too small (${width}x${height}). Minimum is 400x400.` };
  }

  // Verify companion .provenance.json manifest
  const manifestCandidates = [
    `${fixturePath}.provenance.json`,
    path.join(path.dirname(fixturePath), `${path.basename(fixturePath, ext)}.provenance.json`)
  ];

  let manifestPath: string | null = null;
  for (const candidate of manifestCandidates) {
    if (fs.existsSync(candidate)) {
      manifestPath = candidate;
      break;
    }
  }

  if (!manifestPath) {
    return {
      valid: false,
      error: `Missing required machine-readable fixture provenance manifest (.provenance.json) for ${path.basename(fixturePath)}`
    };
  }

  let manifest: any;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (err: any) {
    return { valid: false, error: `Malformed provenance JSON manifest: ${err.message}` };
  }

  const calculatedHash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (!manifest.sha256 || manifest.sha256.toLowerCase() !== calculatedHash.toLowerCase()) {
    return {
      valid: false,
      error: `Provenance sha256 mismatch for ${path.basename(fixturePath)}. Manifest: ${manifest.sha256}, actual: ${calculatedHash}`
    };
  }

  // Reject bundled synthetic illustrations derived from SVG assets
  if (
    manifest.fixture_type === "SYNTHETIC_DEMO_ILLUSTRATION" ||
    manifest.fixture_type === "SYNTHETIC_FALLBACK" ||
    path.basename(fixturePath).includes("sample_wearer_reference") ||
    path.basename(fixturePath).includes("sample_garment_overcoat") ||
    path.basename(fixturePath).includes("sample_vto_result")
  ) {
    return {
      valid: false,
      error: `Synthetic demo illustrations derived from SVG assets are strictly rejected for live provider verification. Provide genuine photographs via LIVE_SMOKE_PERSON_FIXTURE and LIVE_SMOKE_GARMENT_FIXTURE.`
    };
  }

  if (!manifest.license && !manifest.source && !manifest.provenance) {
    return { valid: false, error: `Provenance manifest missing required license, source, or provenance attributes.` };
  }

  manifest.authority = "USER_SUPPLIED_PROVENANCE_NOT_INDEPENDENTLY_VERIFIED";
  manifest.fixture_type = "USER_PROVIDED_PHOTOGRAPH";

  return {
    valid: true,
    manifest,
    sha256: calculatedHash,
    width,
    height,
    mimeType: format === "png" ? "image/png" : "image/jpeg",
    buffer
  };
}

export interface SmokeOptions {
  requireLive?: boolean;
  apiKey?: string;
  baseUrl?: string;
  personFixturePath?: string;
  garmentFixturePath?: string;
  commitSha?: string;
  customProvider?: YouCamClothesProvider;
  docsDir?: string;
}

export async function runSmoke(options: SmokeOptions = {}): Promise<SmokeReceipt> {
  const requireLive = options.requireLive ?? (process.argv.includes("--require-live") || process.env.REQUIRE_LIVE === "1");
  const apiKey = options.apiKey ?? process.env.YOUCAM_API_KEY;
  const baseUrl = options.baseUrl ?? process.env.YOUCAM_BASE_URL ?? "https://yce-api-01.makeupar.com";
  const commitSha = options.commitSha ?? getCommitSha();
  const docsDir = options.docsDir ?? path.resolve(process.cwd(), "docs");
  const startTime = Date.now();

  console.log(`[WearerKey Live Smoke] Initiating YouCam Clothes V4 live smoke suite...`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Commit SHA: ${commitSha}`);
  console.log(`  Require Live: ${requireLive}`);

  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // 1. Check API Key presence
  if (!apiKey || apiKey.trim().length < 15) {
    console.log(`[WearerKey Live Smoke] YOUCAM_API_KEY is not configured or placeholder.`);

    const receipt: SmokeReceipt = {
      evaluated_commit_sha: commitSha,
      provider_mode: "DEMO_FIXTURE",
      endpoint: baseUrl,
      timestamp: new Date().toISOString(),
      connectivity_status: "BLOCKED_MISSING_KEY",
      http_status: 0,
      live_execution_verified: false,
      generation_verified: false,
      deletion_verified: false,
      model_name: "YouCam AI Clothes V4",
      api_family: "AI_CLOTHES_V4",
      reason: "YOUCAM_API_KEY not configured. System operating in deterministic DEMO_FIXTURE / RECORDED_LIVE_RESULT mode without fabricating live execution."
    };

    fs.writeFileSync(
      path.join(docsDir, "live-youcam-receipt.json"),
      JSON.stringify(receipt, null, 2)
    );
    console.log(`[WearerKey Live Smoke] Truthful non-live receipt recorded in docs/live-youcam-receipt.json`);

    if (requireLive) {
      console.error(`[WearerKey Live Smoke] FAIL-CLOSED: --require-live was requested but YOUCAM_API_KEY is absent.`);
      if (!options.customProvider) process.exit(1);
    }
    return receipt;
  }

  // 2. Locate and validate photographic fixtures
  console.log(`[WearerKey Live Smoke] Resolving test image fixtures...`);

  const personFixturePath = options.personFixturePath ?? process.env.LIVE_SMOKE_PERSON_FIXTURE;
  const garmentFixturePath = options.garmentFixturePath ?? process.env.LIVE_SMOKE_GARMENT_FIXTURE;

  if (!personFixturePath || !garmentFixturePath) {
    const missingMsg = "Live smoke verification requires explicit paths via LIVE_SMOKE_PERSON_FIXTURE and LIVE_SMOKE_GARMENT_FIXTURE. Bundled synthetic demo illustrations cannot be used for live verification.";
    console.error(`[WearerKey Live Smoke] FAIL-CLOSED: ${missingMsg}`);

    const receipt: SmokeReceipt = {
      evaluated_commit_sha: commitSha,
      provider_mode: "LIVE_YOUCAM",
      endpoint: baseUrl,
      timestamp: new Date().toISOString(),
      connectivity_status: "FIXTURE_REJECTED",
      http_status: 400,
      live_execution_verified: false,
      generation_verified: false,
      deletion_verified: false,
      model_name: "YouCam AI Clothes V4",
      api_family: "AI_CLOTHES_V4",
      reason: missingMsg,
      error: "Missing required LIVE_SMOKE_PERSON_FIXTURE or LIVE_SMOKE_GARMENT_FIXTURE"
    };

    fs.writeFileSync(
      path.join(docsDir, "live-youcam-receipt.json"),
      JSON.stringify(receipt, null, 2)
    );

    if (requireLive && !options.customProvider) {
      process.exit(1);
    }
    return receipt;
  }

  const personCheck = await validateFixture(personFixturePath);
  const garmentCheck = await validateFixture(garmentFixturePath);

  if (!personCheck.valid || !garmentCheck.valid) {
    const errorDetail = `Person check: ${personCheck.error || "OK"}; Garment check: ${garmentCheck.error || "OK"}`;
    console.error(`[WearerKey Live Smoke] FAIL-CLOSED: Fixture validation failed. ${errorDetail}`);

    const receipt: SmokeReceipt = {
      evaluated_commit_sha: commitSha,
      provider_mode: "LIVE_YOUCAM",
      endpoint: baseUrl,
      timestamp: new Date().toISOString(),
      connectivity_status: "FIXTURE_REJECTED",
      http_status: 400,
      live_execution_verified: false,
      generation_verified: false,
      deletion_verified: false,
      model_name: "YouCam AI Clothes V4",
      api_family: "AI_CLOTHES_V4",
      reason: `Live execution rejected: photographic person and garment fixtures with matching .provenance.json required. ${errorDetail}`,
      error: errorDetail
    };

    fs.writeFileSync(
      path.join(docsDir, "live-youcam-receipt.json"),
      JSON.stringify(receipt, null, 2)
    );

    if (requireLive && !options.customProvider) {
      process.exit(1);
    }
    return receipt;
  }

  const sourceImage: SanitizedImage = {
    buffer: personCheck.buffer!,
    mimeType: personCheck.mimeType as any,
    width: personCheck.width!,
    height: personCheck.height!,
    byteSize: personCheck.buffer!.length,
    contentHash: calculateContentHash(personCheck.buffer!)
  };

  const garmentImage: SanitizedImage = {
    buffer: garmentCheck.buffer!,
    mimeType: garmentCheck.mimeType as any,
    width: garmentCheck.width!,
    height: garmentCheck.height!,
    byteSize: garmentCheck.buffer!.length,
    contentHash: calculateContentHash(garmentCheck.buffer!)
  };

  const provenance: FixtureProvenanceRecord = {
    person_fixture_type: "USER_PROVIDED_PHOTOGRAPH",
    garment_fixture_type: "USER_PROVIDED_PHOTOGRAPH",
    authority: "USER_SUPPLIED_PROVENANCE_NOT_INDEPENDENTLY_VERIFIED",
    license_or_provenance: `${personCheck.manifest.license || personCheck.manifest.provenance || "User Provided"} / ${garmentCheck.manifest.license || garmentCheck.manifest.provenance || "User Provided"}`,
    person_sha256: personCheck.sha256,
    garment_sha256: garmentCheck.sha256,
    manifest_verified: true
  };

  console.log(`[WearerKey Live Smoke] Executing live Clothes V4 pipeline...`);
  const provider = options.customProvider ?? new YouCamClothesProvider(baseUrl, apiKey);

  // Resource tracking for fail-closed cleanup in finally block
  let uploadedSourceFileId: string | null = null;
  let uploadedGarmentFileId: string | null = null;
  let createdTaskId: string | null = null;
  let generationSucceeded = false;
  let latency = 0;
  let pollStatus: any = null;
  let caughtError: any = null;

  // Deletion tracking
  let taskDelStatus: "CONFIRMED" | "FAILED" | "NOT_REQUESTED" = "NOT_REQUESTED";
  let srcDelStatus: "CONFIRMED" | "FAILED" | "NOT_REQUESTED" = "NOT_REQUESTED";
  let garmDelStatus: "CONFIRMED" | "FAILED" | "NOT_REQUESTED" = "NOT_REQUESTED";

  try {
    // 3. Upload source reference photo
    console.log(`  1/5 Uploading source reference image to /s2s/v2.0/file...`);
    const sourceFile = await provider.uploadImage(sourceImage, "source");
    uploadedSourceFileId = sourceFile.fileId;
    console.log(`    Source upload successful (masked ID: ${sourceFile.fileId.slice(0, 4)}...${sourceFile.fileId.slice(-4)})`);

    // 4. Upload garment photo
    console.log(`  2/5 Uploading garment image to /s2s/v2.0/file...`);
    const garmentFile = await provider.uploadImage(garmentImage, "garment");
    uploadedGarmentFileId = garmentFile.fileId;
    console.log(`    Garment upload successful (masked ID: ${garmentFile.fileId.slice(0, 4)}...${garmentFile.fileId.slice(-4)})`);

    // 5. Dispatch Clothes V4 task
    console.log(`  3/5 Submitting Clothes V4 task to /s2s/v2.0/task/cloth-v4...`);
    const task = await provider.createTask({
      srcFileId: sourceFile.fileId,
      refFileId: garmentFile.fileId,
      garmentCategory: "outer",
      filterMultiPerson: "strict"
    });
    createdTaskId = task.taskId;
    console.log(`    Task created (masked ID: ${task.taskId.slice(0, 4)}...${task.taskId.slice(-4)})`);

    // 6. Poll for completion
    console.log(`  4/5 Polling task status...`);
    pollStatus = await provider.pollTask(task.taskId, 90000);
    latency = Date.now() - startTime;
    console.log(`    Task terminal status: ${pollStatus.status} (${latency}ms)`);

    generationSucceeded = pollStatus.status === "SUCCEEDED" && !!pollStatus.resultUrl;
  } catch (err: any) {
    caughtError = err;
    console.error(`[WearerKey Live Smoke] Exception during execution: ${err.message}`);
  } finally {
    // Fail-Closed Cleanup: Always delete remote task and files regardless of errors
    console.log(`  5/5 Executing fail-closed resource deletions...`);
    if (createdTaskId) {
      try {
        const taskDel = await provider.deleteTask(createdTaskId);
        taskDelStatus = taskDel.confirmed ? "CONFIRMED" : "FAILED";
      } catch {
        taskDelStatus = "FAILED";
      }
    }
    if (uploadedSourceFileId) {
      try {
        const srcDel = await provider.deleteFile(uploadedSourceFileId);
        srcDelStatus = srcDel ? "CONFIRMED" : "FAILED";
      } catch {
        srcDelStatus = "FAILED";
      }
    }
    if (uploadedGarmentFileId) {
      try {
        const garmDel = await provider.deleteFile(uploadedGarmentFileId);
        garmDelStatus = garmDel ? "CONFIRMED" : "FAILED";
      } catch {
        garmDelStatus = "FAILED";
      }
    }
    console.log(`    Task deletion: ${taskDelStatus}`);
    console.log(`    Source deletion: ${srcDelStatus}`);
    console.log(`    Garment deletion: ${garmDelStatus}`);
  }

  const allDeletionsConfirmed = taskDelStatus === "CONFIRMED" && srcDelStatus === "CONFIRMED" && garmDelStatus === "CONFIRMED";
  const saltedTaskIdHash = createdTaskId
    ? crypto.createHash("sha256").update(createdTaskId + ":" + commitSha).digest("hex").slice(0, 16)
    : undefined;

  let connectivityStatus: SmokeReceipt["connectivity_status"] = "CONNECTED";
  let httpStatus = 200;

  if (caughtError) {
    connectivityStatus = caughtError.message?.includes("timeout") ? "TIMEOUT" : "AUTH_FAILED";
    httpStatus = 500;
  } else if (!generationSucceeded) {
    connectivityStatus = "AUTH_FAILED";
    httpStatus = 400;
  }

  const receipt: SmokeReceipt = {
    evaluated_commit_sha: commitSha,
    provider_mode: "LIVE_YOUCAM",
    endpoint: baseUrl,
    timestamp: new Date().toISOString(),
    connectivity_status: connectivityStatus,
    http_status: httpStatus,
    live_execution_verified: generationSucceeded && allDeletionsConfirmed,
    generation_verified: generationSucceeded,
    deletion_verified: allDeletionsConfirmed,
    model_name: "YouCam AI Clothes V4",
    api_family: "AI_CLOTHES_V4",
    latency_ms: latency,
    task_id_hash: saltedTaskIdHash,
    deletion_breakdown: {
      task_deletion: taskDelStatus,
      source_deletion: srcDelStatus,
      garment_deletion: garmDelStatus,
      all_deletions_confirmed: allDeletionsConfirmed
    },
    fixture_provenance: provenance,
    reason: generationSucceeded && allDeletionsConfirmed
      ? "Live YouCam Clothes V4 verified end-to-end with authentic photographic fixtures."
      : (caughtError ? caughtError.message : `Provider status: ${pollStatus?.status || "FAILED"}`),
    ...(caughtError ? { error: caughtError.message } : {})
  };

  fs.writeFileSync(
    path.join(docsDir, "live-youcam-receipt.json"),
    JSON.stringify(receipt, null, 2)
  );
  console.log(`[WearerKey Live Smoke] Receipt recorded in docs/live-youcam-receipt.json`);

  if (requireLive && (!generationSucceeded || !allDeletionsConfirmed) && !options.customProvider) {
    console.error(`[WearerKey Live Smoke] FAIL-CLOSED: Generation or deletion unconfirmed.`);
    process.exit(1);
  }

  return receipt;
}

// Execute directly if run as main script
const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith("live-youcam-smoke.ts") ||
  process.argv[1].endsWith("live-youcam-smoke.js")
);

if (isDirectExecution) {
  runSmoke().catch((err) => {
    console.error("Fatal error running live smoke:", err);
    process.exit(1);
  });
}
