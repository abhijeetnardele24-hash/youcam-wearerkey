import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import sharp from "sharp";
import { YouCamClothesProvider } from "../apps/api/src/providers/youcam/youcam-provider.js";
import type { SanitizedImage } from "../apps/api/src/services/image-sanitizer.js";
import { calculateContentHash } from "../packages/domain/src/crypto.js";

interface SmokeReceipt {
  evaluated_commit_sha: string;
  provider_mode: "LIVE_YOUCAM" | "DEMO_FIXTURE" | "RECORDED_LIVE_RESULT";
  endpoint: string;
  timestamp: string;
  connectivity_status: "CONNECTED" | "BLOCKED_MISSING_KEY" | "AUTH_FAILED" | "OFFLINE";
  http_status: number;
  live_execution_verified: boolean;
  model_name: string;
  latency_ms?: number;
  task_id_hash?: string;
  deletion_status?: string;
  reason?: string;
  error?: string;
}

function getCommitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return process.env.GIT_COMMIT_SHA || "UNKNOWN_COMMIT";
  }
}

async function runSmoke() {
  const args = process.argv.slice(2);
  const requireLive = args.includes("--require-live") || process.env.REQUIRE_LIVE === "1";
  const apiKey = process.env.YOUCAM_API_KEY;
  const baseUrl = process.env.YOUCAM_BASE_URL || "https://yce-api-01.makeupar.com";
  const commitSha = getCommitSha();
  const startTime = Date.now();

  console.log(`[WearerKey Live Smoke] Checking YouCam Clothes V4 connectivity...`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Commit SHA: ${commitSha}`);
  console.log(`  Require Live: ${requireLive}`);

  const docsDir = path.resolve(process.cwd(), "docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  if (!apiKey) {
    console.log(`[WearerKey Live Smoke] YOUCAM_API_KEY is not configured.`);

    const receipt: SmokeReceipt = {
      evaluated_commit_sha: commitSha,
      provider_mode: "DEMO_FIXTURE",
      endpoint: baseUrl,
      timestamp: new Date().toISOString(),
      connectivity_status: "BLOCKED_MISSING_KEY",
      http_status: 0,
      live_execution_verified: false,
      model_name: "YouCam AI Clothes V4",
      reason: "YOUCAM_API_KEY not configured. System operating in deterministic DEMO_FIXTURE / RECORDED_LIVE_RESULT mode without fabricating live execution."
    };

    fs.writeFileSync(
      path.join(docsDir, "live-youcam-receipt.json"),
      JSON.stringify(receipt, null, 2)
    );
    console.log(`[WearerKey Live Smoke] Truthful non-live receipt recorded in docs/live-youcam-receipt.json`);

    if (requireLive) {
      console.error(`[WearerKey Live Smoke] FAIL-CLOSED: --require-live was requested but YOUCAM_API_KEY is not set.`);
      process.exit(1);
    }
    return;
  }

  // Live API key is provided! Execute live Clothes V4 try-on
  console.log(`[WearerKey Live Smoke] YOUCAM_API_KEY detected. Initializing YouCamClothesProvider...`);

  try {
    const provider = new YouCamClothesProvider(baseUrl, apiKey);

    // 1. Obtain detectable reference person & garment test fixtures
    let sourceBuffer: Buffer;
    let garmentBuffer: Buffer;

    const samplePersonPath = path.resolve(process.cwd(), "apps/api/public/sample_wearer_reference.png");
    const sampleGarmentPath = path.resolve(process.cwd(), "apps/api/public/sample_garment_overcoat.png");

    if (fs.existsSync(samplePersonPath) && fs.existsSync(sampleGarmentPath)) {
      sourceBuffer = fs.readFileSync(samplePersonPath);
      garmentBuffer = fs.readFileSync(sampleGarmentPath);
    } else {
      // Create detectable SVG silhouette fallbacks if files missing
      const personSvg = `
        <svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#F5F0E7"/>
          <circle cx="300" cy="180" r="70" fill="#D99B77"/>
          <path d="M 220 280 Q 300 240 380 280 L 420 520 L 180 520 Z" fill="#2D3748"/>
          <rect x="220" y="520" width="70" height="250" fill="#1A202C"/>
          <rect x="310" y="520" width="70" height="250" fill="#1A202C"/>
        </svg>
      `;
      const garmentSvg = `
        <svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#FAF7F2"/>
          <path d="M 150 100 L 220 180 L 280 180 L 350 100 L 400 160 L 340 450 L 160 450 L 100 160 Z" fill="#70465E"/>
        </svg>
      `;
      sourceBuffer = await sharp(Buffer.from(personSvg)).png().toBuffer();
      garmentBuffer = await sharp(Buffer.from(garmentSvg)).png().toBuffer();
    }

    const sourceMeta = await sharp(sourceBuffer).metadata();
    const garmentMeta = await sharp(garmentBuffer).metadata();

    const sourceImage: SanitizedImage = {
      buffer: sourceBuffer,
      mimeType: "image/png",
      width: sourceMeta.width || 600,
      height: sourceMeta.height || 800,
      byteSize: sourceBuffer.length,
      contentHash: calculateContentHash(sourceBuffer)
    };

    const garmentImage: SanitizedImage = {
      buffer: garmentBuffer,
      mimeType: "image/png",
      width: garmentMeta.width || 500,
      height: garmentMeta.height || 500,
      byteSize: garmentBuffer.length,
      contentHash: calculateContentHash(garmentBuffer)
    };

    // 2. Upload source via official presigned protocol
    console.log(`  Uploading source reference image...`);
    const sourceFile = await provider.uploadImage(sourceImage, "source");
    console.log(`  Source uploaded (masked ID): ${sourceFile.fileId.slice(0, 4)}...${sourceFile.fileId.slice(-4)}`);

    // 3. Upload garment via official presigned protocol
    console.log(`  Uploading garment image...`);
    const garmentFile = await provider.uploadImage(garmentImage, "garment");
    console.log(`  Garment uploaded (masked ID): ${garmentFile.fileId.slice(0, 4)}...${garmentFile.fileId.slice(-4)}`);

    // 4. Create Clothes V4 task
    console.log(`  Creating Clothes V4 task...`);
    const task = await provider.createTask({
      srcFileId: sourceFile.fileId,
      refFileId: garmentFile.fileId,
      garmentCategory: "upper_body"
    });
    console.log(`  Task created (masked ID): ${task.taskId.slice(0, 4)}...${task.taskId.slice(-4)}`);

    // 5. Poll for completion
    console.log(`  Polling task status...`);
    const status = await provider.pollTask(task.taskId, 60000);
    const latency = Date.now() - startTime;
    console.log(`  Task completed with status: ${status.status} (${latency}ms)`);

    // 6. Delete remote task and files
    console.log(`  Purging remote task and files...`);
    const taskDel = await provider.deleteTask(task.taskId);
    const srcDel = await provider.deleteFile(sourceFile.fileId);
    const garmDel = await provider.deleteFile(garmentFile.fileId);

    const isPurged = taskDel.confirmed && srcDel && garmDel;
    const saltedTaskIdHash = crypto.createHash("sha256").update(task.taskId + ":" + commitSha).digest("hex").slice(0, 16);

    const receipt: SmokeReceipt = {
      evaluated_commit_sha: commitSha,
      provider_mode: "LIVE_YOUCAM",
      endpoint: baseUrl,
      timestamp: new Date().toISOString(),
      connectivity_status: "CONNECTED",
      http_status: 200,
      live_execution_verified: status.status === "SUCCEEDED",
      model_name: "YouCam AI Clothes V4",
      latency_ms: latency,
      task_id_hash: saltedTaskIdHash,
      deletion_status: isPurged ? "CONFIRMED" : "PARTIAL_FAILURE",
      reason: status.status === "SUCCEEDED" ? "Live YouCam Clothes V4 verified end-to-end" : status.errorMessage
    };

    fs.writeFileSync(
      path.join(docsDir, "live-youcam-receipt.json"),
      JSON.stringify(receipt, null, 2)
    );
    console.log(`[WearerKey Live Smoke] Live receipt recorded in docs/live-youcam-receipt.json`);

    if (status.status !== "SUCCEEDED" && requireLive) {
      console.error(`[WearerKey Live Smoke] Task failed on provider side: ${status.errorMessage}`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`[WearerKey Live Smoke] Live execution failed:`, err.message);
    const receipt: SmokeReceipt = {
      evaluated_commit_sha: commitSha,
      provider_mode: "LIVE_YOUCAM",
      endpoint: baseUrl,
      timestamp: new Date().toISOString(),
      connectivity_status: "AUTH_FAILED",
      http_status: 500,
      live_execution_verified: false,
      model_name: "YouCam AI Clothes V4",
      error: `Live YouCam task failed: ${err.message}`
    };
    fs.writeFileSync(
      path.join(docsDir, "live-youcam-receipt.json"),
      JSON.stringify(receipt, null, 2)
    );

    if (requireLive) {
      process.exit(1);
    }
  }
}

runSmoke();
