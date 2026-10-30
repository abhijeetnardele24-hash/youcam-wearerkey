import crypto from "node:crypto";

/**
 * Generates a cryptographically random 256-bit capability token.
 * Encoded as URL-safe base64 string.
 */
export function generateCapabilityToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Computes the SHA-256 hash of a capability token for safe at-rest storage.
 * Only the hash is stored in the database; raw capability tokens are never stored.
 */
export function hashCapabilityToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Performs a constant-time comparison of two token hashes to prevent timing attacks.
 */
export function verifyTokenHash(candidateHash: string, storedHash: string): boolean {
  if (candidateHash.length !== storedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(candidateHash, "hex"),
    Buffer.from(storedHash, "hex")
  );
}

/**
 * Computes a SHA-256 hex digest of image bytes or arbitrary buffer content.
 */
export function calculateContentHash(buffer: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generates an idempotency fingerprint for a proposal to prevent duplicate paid task invocations.
 */
export function generateProposalFingerprint(params: {
  sessionId: string;
  sourceContentHash: string;
  garmentContentHash: string;
  category: string;
  consentVersion: string;
}): string {
  const payload = `${params.sessionId}:${params.sourceContentHash}:${params.garmentContentHash}:${params.category}:${params.consentVersion}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Symmetric AES-256-GCM encryption for third-party provider file IDs and task URLs at rest.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptProviderIdentifier(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }

  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Symmetric AES-256-GCM decryption for third-party provider identifiers.
 */
export function decryptProviderIdentifier(encryptedPayload: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted provider identifier payload");
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

/**
 * Deterministically canonicalizes a JSON object into a sorted-key string representation.
 */
export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalizeJson).join(",")}]`;
  }
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `"${k}":${canonicalizeJson(obj[k])}`).join(",")}}`;
}

/**
 * Creates an HMAC-SHA256 signature over a canonicalized receipt payload.
 */
export function signReceiptPayload(
  payload: Record<string, any>,
  secretKeyHex: string,
  keyId = "wearerkey-audit-key-v1"
): { signature: string; key_id: string; algorithm: "HMAC-SHA256"; signed_at: string } {
  const signedAt = new Date().toISOString();
  // Clean payload by removing any existing receipt_hmac to prevent circular hashing
  const cleanPayload = { ...payload };
  delete cleanPayload.receipt_hmac;

  const canonicalData = canonicalizeJson({ ...cleanPayload, signed_at: signedAt });
  const key = Buffer.from(secretKeyHex, "hex");
  const signature = crypto.createHmac("sha256", key).update(canonicalData, "utf8").digest("base64");

  return {
    signature,
    key_id: keyId,
    algorithm: "HMAC-SHA256",
    signed_at: signedAt
  };
}

/**
 * Verifies an HMAC-SHA256 signature over a canonicalized receipt payload in constant time.
 */
export function verifyReceiptSignature(
  payload: Record<string, any>,
  signature: string,
  signedAt: string,
  secretKeyHex: string
): boolean {
  try {
    const cleanPayload = { ...payload };
    delete cleanPayload.receipt_hmac;

    const canonicalData = canonicalizeJson({ ...cleanPayload, signed_at: signedAt });
    const key = Buffer.from(secretKeyHex, "hex");
    const expectedSig = crypto.createHmac("sha256", key).update(canonicalData, "utf8").digest("base64");

    const sigBuf = Buffer.from(signature, "base64");
    const expectedBuf = Buffer.from(expectedSig, "base64");

    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
