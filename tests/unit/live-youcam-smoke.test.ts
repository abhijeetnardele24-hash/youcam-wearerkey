import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { validateFixture, runSmoke } from "../../scripts/live-youcam-smoke.js";
import { YouCamClothesProvider } from "../../apps/api/src/providers/youcam/youcam-provider.js";

describe("Live YouCam Smoke Script & Fixture Provenance Tests", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects synthetic SVG fixtures with clear explanation", async () => {
    const svgPath = path.join(tempDir, "synthetic.svg");
    fs.writeFileSync(svgPath, "<svg><circle cx='50' cy='50' r='40'/></svg>");

    const res = await validateFixture(svgPath);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/synthetic svgs/i);
  });

  it("rejects undersized or placeholder files (<10KB)", async () => {
    const tinyPath = path.join(tempDir, "tiny.png");
    fs.writeFileSync(tinyPath, Buffer.alloc(500, 0));

    const res = await validateFixture(tinyPath);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/too small/i);
  });

  it("rejects fixtures missing companion .provenance.json manifest", async () => {
    // Copy authentic fixture from public but do not copy manifest
    const src = path.resolve(process.cwd(), "apps/api/public/sample_wearer_reference.png");
    const dest = path.join(tempDir, "test_photo.png");
    fs.copyFileSync(src, dest);

    const res = await validateFixture(dest);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/missing required.*provenance/i);
  });

  it("rejects fixtures when .provenance.json sha256 does not match", async () => {
    const src = path.resolve(process.cwd(), "apps/api/public/sample_wearer_reference.png");
    const dest = path.join(tempDir, "test_photo.png");
    fs.copyFileSync(src, dest);

    // Write manifest with bogus hash
    const manifestPath = path.join(tempDir, "test_photo.png.provenance.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        source: "Unsplash",
        license: "Unsplash License",
        sha256: "0000000000000000000000000000000000000000000000000000000000000000"
      })
    );

    const res = await validateFixture(dest);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/sha256 mismatch/i);
  });

  it("accepts authentic photographic fixtures with valid .provenance.json manifest", async () => {
    const srcPhoto = path.resolve(process.cwd(), "apps/api/public/sample_wearer_reference.png");
    const srcManifest = path.resolve(process.cwd(), "apps/api/public/sample_wearer_reference.png.provenance.json");

    const destPhoto = path.join(tempDir, "sample_wearer.png");
    const destManifest = path.join(tempDir, "sample_wearer.png.provenance.json");

    fs.copyFileSync(srcPhoto, destPhoto);
    fs.copyFileSync(srcManifest, destManifest);

    const res = await validateFixture(destPhoto);
    expect(res.valid).toBe(true);
    expect(res.width).toBeGreaterThanOrEqual(400);
    expect(res.height).toBeGreaterThanOrEqual(400);
    expect(res.manifest.source).toBeDefined();
    expect(res.sha256).toBeDefined();
  });

  it("runSmoke writes truthful DEMO_FIXTURE receipt when YOUCAM_API_KEY is missing", async () => {
    const docsDir = path.join(tempDir, "docs");
    const receipt = await runSmoke({
      apiKey: "",
      docsDir,
      requireLive: false,
      commitSha: "test_sha_123"
    });

    expect(receipt.provider_mode).toBe("DEMO_FIXTURE");
    expect(receipt.connectivity_status).toBe("BLOCKED_MISSING_KEY");
    expect(receipt.live_execution_verified).toBe(false);
    expect(receipt.generation_verified).toBe(false);
    expect(receipt.deletion_verified).toBe(false);
    expect(receipt.evaluated_commit_sha).toBe("test_sha_123");

    const writtenReceipt = JSON.parse(fs.readFileSync(path.join(docsDir, "live-youcam-receipt.json"), "utf-8"));
    expect(writtenReceipt.provider_mode).toBe("DEMO_FIXTURE");
  });

  it("runSmoke executes fail-closed deletions in finally block even when task polling throws an error", async () => {
    const docsDir = path.join(tempDir, "docs");

    // Copy valid fixtures
    const personPhoto = path.join(tempDir, "person.png");
    const personManifest = path.join(tempDir, "person.png.provenance.json");
    fs.copyFileSync(path.resolve(process.cwd(), "apps/api/public/sample_wearer_reference.png"), personPhoto);
    fs.copyFileSync(path.resolve(process.cwd(), "apps/api/public/sample_wearer_reference.png.provenance.json"), personManifest);

    const garmentPhoto = path.join(tempDir, "garment.png");
    const garmentManifest = path.join(tempDir, "garment.png.provenance.json");
    fs.copyFileSync(path.resolve(process.cwd(), "apps/api/public/sample_garment_overcoat.png"), garmentPhoto);
    fs.copyFileSync(path.resolve(process.cwd(), "apps/api/public/sample_garment_overcoat.png.provenance.json"), garmentManifest);

    // Mock provider that fails during polling
    const mockProvider = new YouCamClothesProvider("https://fake.url", "valid_api_key_1234567890");
    vi.spyOn(mockProvider, "uploadImage").mockImplementation(async (_, type) => ({
      fileId: `file_${type}_999`,
      fileType: type as any,
      downloadUrl: "https://fake.url/file"
    }));
    vi.spyOn(mockProvider, "createTask").mockResolvedValue({
      taskId: "task_smoke_failure_test",
      status: "RUNNING"
    });
    vi.spyOn(mockProvider, "pollTask").mockRejectedValue(new Error("Polling timeout after 90s"));

    const deleteTaskSpy = vi.spyOn(mockProvider, "deleteTask").mockResolvedValue({
      taskId: "task_smoke_failure_test",
      confirmed: true,
      providerStatus: "DELETED",
      deletionMode: "GENUINE_PROVIDER_CONFIRMED"
    });
    const deleteFileSpy = vi.spyOn(mockProvider, "deleteFile").mockResolvedValue(true);

    const receipt = await runSmoke({
      apiKey: "valid_api_key_1234567890",
      baseUrl: "https://fake.url",
      personFixturePath: personPhoto,
      garmentFixturePath: garmentPhoto,
      customProvider: mockProvider,
      docsDir,
      requireLive: false,
      commitSha: "commit_cleanup_sha"
    });

    // Verify cleanup was invoked in finally block despite polling error
    expect(deleteTaskSpy).toHaveBeenCalledWith("task_smoke_failure_test");
    expect(deleteFileSpy).toHaveBeenCalledWith("file_source_999");
    expect(deleteFileSpy).toHaveBeenCalledWith("file_garment_999");

    expect(receipt.live_execution_verified).toBe(false);
    expect(receipt.deletion_breakdown?.task_deletion).toBe("CONFIRMED");
    expect(receipt.deletion_breakdown?.all_deletions_confirmed).toBe(true);
    expect(receipt.connectivity_status).toBe("TIMEOUT");
  });

  it("runSmoke records successful live execution when generation and task deletion confirm", async () => {
    const docsDir = path.join(tempDir, "docs");

    const personPhoto = path.join(tempDir, "person.png");
    const personManifest = path.join(tempDir, "person.png.provenance.json");
    fs.copyFileSync(path.resolve(process.cwd(), "apps/api/public/sample_wearer_reference.png"), personPhoto);
    fs.copyFileSync(path.resolve(process.cwd(), "apps/api/public/sample_wearer_reference.png.provenance.json"), personManifest);

    const garmentPhoto = path.join(tempDir, "garment.png");
    const garmentManifest = path.join(tempDir, "garment.png.provenance.json");
    fs.copyFileSync(path.resolve(process.cwd(), "apps/api/public/sample_garment_overcoat.png"), garmentPhoto);
    fs.copyFileSync(path.resolve(process.cwd(), "apps/api/public/sample_garment_overcoat.png.provenance.json"), garmentManifest);

    const mockProvider = new YouCamClothesProvider("https://fake.url", "valid_api_key_1234567890");
    vi.spyOn(mockProvider, "uploadImage").mockImplementation(async (_, type) => ({
      fileId: `file_${type}_success`,
      fileType: type as any,
      downloadUrl: "https://fake.url/file"
    }));
    vi.spyOn(mockProvider, "createTask").mockResolvedValue({
      taskId: "task_smoke_success",
      status: "RUNNING"
    });
    vi.spyOn(mockProvider, "pollTask").mockResolvedValue({
      taskId: "task_smoke_success",
      status: "SUCCEEDED",
      resultUrl: "https://yce-api-01.makeupar.com/results/vto_123.jpg"
    });
    vi.spyOn(mockProvider, "deleteTask").mockResolvedValue({
      taskId: "task_smoke_success",
      confirmed: true,
      providerStatus: "DELETED",
      deletionMode: "GENUINE_PROVIDER_CONFIRMED"
    });
    vi.spyOn(mockProvider, "deleteFile").mockResolvedValue(true);

    const receipt = await runSmoke({
      apiKey: "valid_api_key_1234567890",
      baseUrl: "https://fake.url",
      personFixturePath: personPhoto,
      garmentFixturePath: garmentPhoto,
      customProvider: mockProvider,
      docsDir,
      requireLive: false,
      commitSha: "commit_success_sha"
    });

    expect(receipt.live_execution_verified).toBe(true);
    expect(receipt.generation_verified).toBe(true);
    expect(receipt.deletion_verified).toBe(true);
    expect(receipt.connectivity_status).toBe("CONNECTED");
    expect(receipt.evaluated_commit_sha).toBe("commit_success_sha");
    expect(receipt.fixture_provenance?.manifest_verified).toBe(true);
  });
});
