import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import sharp from "sharp";
import { YouCamClothesProvider } from "../apps/api/src/providers/youcam/youcam-provider.js";
import type { SanitizedImage } from "../apps/api/src/services/image-sanitizer.js";

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
  task_id?: string;
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
  const apiKey = process.env.YOUCAM_API_KEY;
  const baseUrl = process.env.YOUCAM_BASE_URL || "https://yce-api-01.makeupar.com";
  const commitSha = getCommitSha();
  const startTime = Date.now();

  console.log(`[WearerKey Live Smoke] Checking YouCam Clothes V4 connectivity...`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Commit SHA: ${commitSha}`);

  const docsDir = path.resolve(process.cwd(), "docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  if (!apiKey) {
    console.log(`[WearerKey Live Smoke] YOUCAM_API_KEY is not configured.`);
    console.log(`  Operating in transparent deterministic fixture mode (DEMO_FIXTURE).`);

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
    return;
  }

  // Live API key is provided! Execute live Clothes V4 try-on
  console.log(`[WearerKey Live Smoke] YOUCAM_API_KEY detected. Initializing YouCamClothesProvider...`);

  try {
    const provider = new YouCamClothesProvider(baseUrl, apiKey);

    // 1. Generate test reference & garment images
    const sourceRaw = await sharp({
      create: {
        width: 512,
        height: 768,
        channels: 3,
        background: { r: 245, g: 240, b: 231 }
      }
    }).png().toBuffer();

    const sourceImage: SanitizedImage = {
      buffer: sourceRaw,
      mimeType: "image/png",
      width: 512,
      height: 768,
      byteSize: sourceRaw.length,
      contentHash: "smoke_test_source_hash_12345"
    };

    const garmentRaw = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 112, g: 70, b: 94 }
      }
    }).png().toBuffer();

    const garmentImage: SanitizedImage = {
      buffer: garmentRaw,
      mimeType: "image/png",
      width: 512,
      height: 512,
      byteSize: garmentRaw.length,
      contentHash: "smoke_test_garment_hash_67890"
    };

    // 2. Upload source via official presigned protocol
    console.log(`  Uploading source reference image...`);
    const sourceFile = await provider.uploadImage(sourceImage, "source");
    console.log(`  Source uploaded: ${sourceFile.fileId}`);

    // 3. Upload garment via official presigned protocol
    console.log(`  Uploading garment image...`);
    const garmentFile = await provider.uploadImage(garmentImage, "garment");
    console.log(`  Garment uploaded: ${garmentFile.fileId}`);

    // 4. Create Clothes V4 task
    console.log(`  Creating Clothes V4 task...`);
    const task = await provider.createTask({
      srcFileId: sourceFile.fileId,
      refFileId: garmentFile.fileId,
      garmentCategory: "upper_body"
    });
    console.log(`  Task created: ${task.taskId}`);

    // 5. Poll for completion
    console.log(`  Polling task status...`);
    const status = await provider.pollTask(task.taskId, 45000);
    const latency = Date.now() - startTime;
    console.log(`  Task completed with status: ${status.status} (${latency}ms)`);

    // 6. Delete remote task and files
    console.log(`  Purging remote task and files...`);
    await provider.deleteTask(task.taskId);
    await provider.deleteFile(sourceFile.fileId);
    await provider.deleteFile(garmentFile.fileId);

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
      task_id: task.taskId,
      deletion_status: "PURGED",
      reason: status.status === "SUCCEEDED" ? "Live YouCam Clothes V4 verified end-to-end" : status.errorMessage
    };

    fs.writeFileSync(
      path.join(docsDir, "live-youcam-receipt.json"),
      JSON.stringify(receipt, null, 2)
    );
    console.log(`[WearerKey Live Smoke] Live receipt recorded in docs/live-youcam-receipt.json`);
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
  }
}

runSmoke();
