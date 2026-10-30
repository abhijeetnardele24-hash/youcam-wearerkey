import sharp from "sharp";
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
const MIN_DIMENSION = 512;
const MAX_DIMENSION = 4096;

export async function sanitizeAndValidateImage(rawBuffer: Buffer): Promise<SanitizedImage> {
  if (rawBuffer.length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      `File size (${(rawBuffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds maximum permitted limit of 10MB`,
      "FILE_TOO_LARGE"
    );
  }

  // 1. Inspect image metadata via Sharp
  let metadata: sharp.Metadata;
  try {
    const probe = sharp(rawBuffer);
    metadata = await probe.metadata();
  } catch (err) {
    throw new ImageValidationError(
      "Uploaded file is not a valid JPEG or PNG image",
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

  const width = metadata.width || 0;
  const height = metadata.height || 0;

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

  // 2. Re-encode image in-memory to strip all EXIF metadata and malicious embedded payloads
  let sanitizedBuffer: Buffer;
  let mimeType: "image/jpeg" | "image/png";

  if (format === "png") {
    sanitizedBuffer = await sharp(rawBuffer)
      .rotate() // auto-orient based on EXIF before stripping
      .png({ compressionLevel: 8 })
      .toBuffer();
    mimeType = "image/png";
  } else {
    sanitizedBuffer = await sharp(rawBuffer)
      .rotate()
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    mimeType = "image/jpeg";
  }

  const contentHash = calculateContentHash(sanitizedBuffer);

  return {
    buffer: sanitizedBuffer,
    mimeType,
    width,
    height,
    contentHash,
    byteSize: sanitizedBuffer.length
  };
}
