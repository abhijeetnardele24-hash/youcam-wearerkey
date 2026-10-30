import sharp, { type Metadata } from "sharp";
import { calculateContentHash } from "@wearerkey/domain";

export interface SanitizedImage {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png";
  width: number;
  height: number;
  contentHash: string;
  byteSize: number;
}

export class ImageValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MIN_DIMENSION = 256;
const MAX_DIMENSION = 4096;

function validateMagicBytes(buffer: Buffer): "image/jpeg" | "image/png" {
  if (buffer.length < 8) {
    throw new ImageValidationError("File is truncated or empty", "TRUNCATED_FILE");
  }

  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  throw new ImageValidationError(
    "Uploaded file magic bytes do not match standard JPEG or PNG signatures.",
    "UNSUPPORTED_FORMAT"
  );
}

export async function sanitizeAndValidateImage(rawBuffer: Buffer): Promise<SanitizedImage> {
  if (rawBuffer.length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      `File size (${(rawBuffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds maximum permitted limit of 10MB`,
      "FILE_TOO_LARGE"
    );
  }

  // 1. Verify real file magic bytes (prevent mime spoofing)
  const detectedMime = validateMagicBytes(rawBuffer);

  // 2. Decode and inspect with Sharp (bounded against decompression bombs)
  let metadata: Metadata;
  try {
    const instance = sharp(rawBuffer, {
      failOn: "error",
      limitInputPixels: MAX_DIMENSION * MAX_DIMENSION
    });
    metadata = await instance.metadata();
  } catch (err: any) {
    throw new ImageValidationError(
      `Corrupt or malformed image data: ${err.message}`,
      "INVALID_FORMAT"
    );
  }

  const format = metadata.format;
  if (format !== "jpeg" && format !== "png") {
    throw new ImageValidationError(
      `Unsupported image format '${format}'. Only JPEG and PNG files are accepted for YouCam AI Clothes VTO.`,
      "UNSUPPORTED_FORMAT"
    );
  }

  // Auto-orient based on EXIF before measuring final dimensions
  const orientedInstance = sharp(rawBuffer, {
    failOn: "error",
    limitInputPixels: MAX_DIMENSION * MAX_DIMENSION
  }).rotate();

  const orientedMeta = await orientedInstance.metadata();
  const width = orientedMeta.width || metadata.width || 0;
  const height = orientedMeta.height || metadata.height || 0;

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw new ImageValidationError(
      `Image dimensions (${width}x${height}px) are below minimum requirement of ${MIN_DIMENSION}x${MIN_DIMENSION}px for accurate try-on.`,
      "RESOLUTION_TOO_LOW"
    );
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new ImageValidationError(
      `Image dimensions (${width}x${height}px) exceed maximum limit of ${MAX_DIMENSION}x${MAX_DIMENSION}px.`,
      "RESOLUTION_TOO_HIGH"
    );
  }

  // 3. Re-encode image in-memory to strip all EXIF, GPS, camera metadata, and thumbnails
  let sanitizedBuffer: Buffer;
  let finalMime: "image/jpeg" | "image/png";

  if (detectedMime === "image/png" && format === "png") {
    sanitizedBuffer = await sharp(rawBuffer, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION })
      .rotate()
      .png({ compressionLevel: 8 })
      .toBuffer();
    finalMime = "image/png";
  } else {
    sanitizedBuffer = await sharp(rawBuffer, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION })
      .rotate()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    finalMime = "image/jpeg";
  }

  if (sanitizedBuffer.length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      "Sanitized image output exceeds size limits.",
      "FILE_TOO_LARGE"
    );
  }

  const contentHash = calculateContentHash(sanitizedBuffer);

  return {
    buffer: sanitizedBuffer,
    mimeType: finalMime,
    width,
    height,
    contentHash,
    byteSize: sanitizedBuffer.length
  };
}
