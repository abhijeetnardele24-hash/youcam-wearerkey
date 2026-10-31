import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  sanitizeAndValidateImage
} from "../../apps/api/src/services/image-sanitizer.js";

describe("Image Sanitizer & Validator Unit Tests", () => {
  const samplePath = path.resolve(process.cwd(), "apps/api/public/sample_wearer_reference.png");
  const validBytes = fs.readFileSync(samplePath);

  it("successfully sanitizes and calculates hash for authentic PNG photo", async () => {
    const result = await sanitizeAndValidateImage(validBytes);
    expect(result.mimeType).toBe("image/png");
    expect(result.width).toBeGreaterThanOrEqual(256);
    expect(result.height).toBeGreaterThanOrEqual(256);
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.byteSize).toBeGreaterThan(0);
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it("regression: rejects images exceeding 10MB limit with FILE_TOO_LARGE", async () => {
    // Construct fake 11MB buffer
    const hugeBuffer = Buffer.alloc(11 * 1024 * 1024, 0);
    await expect(sanitizeAndValidateImage(hugeBuffer)).rejects.toThrowError(
      expect.objectContaining({
        code: "FILE_TOO_LARGE",
        message: expect.stringContaining("exceeds maximum permitted limit of 10MB")
      })
    );
  });

  it("regression: rejects truncated or empty files (<8 bytes)", async () => {
    const tiny = Buffer.from([0x89, 0x50, 0x4e]);
    await expect(sanitizeAndValidateImage(tiny)).rejects.toThrowError(
      expect.objectContaining({
        code: "TRUNCATED_FILE"
      })
    );
  });

  it("regression: rejects files with unsupported magic bytes (e.g. executable or text)", async () => {
    const fakeExe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00");
    await expect(sanitizeAndValidateImage(fakeExe)).rejects.toThrowError(
      expect.objectContaining({
        code: "UNSUPPORTED_FORMAT"
      })
    );
  });

  it("regression: rejects corrupted images that fail sharp decoding", async () => {
    // Valid PNG magic bytes followed by garbage
    const corruptPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(100, 0x42)
    ]);
    await expect(sanitizeAndValidateImage(corruptPng)).rejects.toThrowError(
      expect.objectContaining({
        code: "INVALID_FORMAT"
      })
    );
  });
});
