import { describe, it, expect } from "vitest";
import {
  generateCapabilityToken,
  hashCapabilityToken,
  verifyTokenHash,
  calculateContentHash,
  generateProposalFingerprint,
  encryptProviderIdentifier,
  decryptProviderIdentifier,
  transitionSession,
  transitionProposal,
  InvalidStateTransitionError,
  evaluateConsentGate,
  mapYouCamError
} from "@wearerkey/domain";

describe("Crypto & Capability Security", () => {
  it("generates 256-bit base64url capability tokens", () => {
    const token = generateCapabilityToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    // 32 bytes in base64url is 43 characters
    expect(token.length).toBeGreaterThanOrEqual(42);
  });

  it("hashes capability tokens deterministically with SHA-256", () => {
    const token = "test-capability-token-value-123456";
    const hash1 = hashCapabilityToken(token);
    const hash2 = hashCapabilityToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // 32 bytes = 64 hex characters
  });

  it("verifies token hashes with constant-time comparison", () => {
    const token = generateCapabilityToken();
    const hash = hashCapabilityToken(token);
    const otherHash = hashCapabilityToken(generateCapabilityToken());

    expect(verifyTokenHash(hash, hash)).toBe(true);
    expect(verifyTokenHash(hash, otherHash)).toBe(false);
  });

  it("computes content hash for image buffers", () => {
    const buffer = Buffer.from("mock image bytes for test");
    const hash = calculateContentHash(buffer);
    expect(hash).toHaveLength(64);
  });

  it("generates stable idempotency fingerprints for identical proposals", () => {
    const params = {
      sessionId: "123e4567-e89b-12d3-a456-426614174000",
      sourceContentHash: "a".repeat(64),
      garmentContentHash: "b".repeat(64),
      category: "outer",
      consentVersion: "2026-10-30-v1"
    };

    const fp1 = generateProposalFingerprint(params);
    const fp2 = generateProposalFingerprint(params);
    expect(fp1).toBe(fp2);

    // Changing category changes fingerprint
    const fp3 = generateProposalFingerprint({ ...params, category: "upper_body" });
    expect(fp1).not.toBe(fp3);
  });

  it("encrypts and decrypts provider identifiers with AES-256-GCM", () => {
    const keyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const rawFileId = "youcam_file_abc123_xyz789";

    const encrypted = encryptProviderIdentifier(rawFileId, keyHex);
    expect(encrypted).not.toContain(rawFileId);
    expect(encrypted.split(":")).toHaveLength(3); // iv:tag:ciphertext

    const decrypted = decryptProviderIdentifier(encrypted, keyHex);
    expect(decrypted).toBe(rawFileId);
  });

  it("fails to decrypt if payload is tampered with", () => {
    const keyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const encrypted = encryptProviderIdentifier("sensitive_id", keyHex);
    const parts = encrypted.split(":");
    // Tamper with ciphertext
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}ff`;

    expect(() => decryptProviderIdentifier(tampered, keyHex)).toThrow();
  });
});

describe("State Machines", () => {
  it("allows valid session state transitions", () => {
    expect(transitionSession("DRAFT", "READY")).toBe("READY");
    expect(transitionSession("READY", "ACTIVE")).toBe("ACTIVE");
    expect(transitionSession("ACTIVE", "COMPLETED")).toBe("COMPLETED");
    expect(transitionSession("ACTIVE", "REVOKED")).toBe("REVOKED");
    expect(transitionSession("COMPLETED", "PURGED")).toBe("PURGED");
  });

  it("rejects illegal session state transitions", () => {
    expect(() => transitionSession("DRAFT", "COMPLETED")).toThrow(InvalidStateTransitionError);
    expect(() => transitionSession("REVOKED", "ACTIVE")).toThrow(InvalidStateTransitionError);
    expect(() => transitionSession("PURGED", "ACTIVE")).toThrow(InvalidStateTransitionError);
  });

  it("allows valid proposal state transitions", () => {
    expect(transitionProposal("CREATED", "READY")).toBe("READY");
    expect(transitionProposal("READY", "UPLOADING")).toBe("UPLOADING");
    expect(transitionProposal("UPLOADING", "SUBMITTED")).toBe("SUBMITTED");
    expect(transitionProposal("SUBMITTED", "PROCESSING")).toBe("PROCESSING");
    expect(transitionProposal("PROCESSING", "SUCCEEDED")).toBe("SUCCEEDED");
    expect(transitionProposal("SUCCEEDED", "REVIEWED")).toBe("REVIEWED");
  });

  it("rejects illegal proposal state transitions", () => {
    expect(() => transitionProposal("CREATED", "SUCCEEDED")).toThrow(InvalidStateTransitionError);
    expect(() => transitionProposal("REVIEWED", "PROCESSING")).toThrow(InvalidStateTransitionError);
  });
});

describe("Consent Gate", () => {
  const baseInput = {
    sessionStatus: "ACTIVE" as const,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    allowedCategories: ["upper_body" as const, "outer" as const],
    garmentCategory: "outer" as const,
    maxProposals: 3,
    currentProposalCount: 1,
    hasSourceImage: true,
    hasGarmentImage: true,
    duplicateFingerprintExists: false
  };

  it("permits compliant proposals", () => {
    const result = evaluateConsentGate(baseInput);
    expect(result.allowed).toBe(true);
    expect(result.code).toBe("OK");
  });

  it("blocks when category is not allowed by wearer", () => {
    const result = evaluateConsentGate({
      ...baseInput,
      garmentCategory: "shoes" as const
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CATEGORY_NOT_ALLOWED");
    expect(result.reason).toContain("only consented to proposals for");
  });

  it("blocks when session is expired", () => {
    const result = evaluateConsentGate({
      ...baseInput,
      expiresAt: new Date(Date.now() - 1000).toISOString()
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SESSION_EXPIRED");
  });

  it("blocks when session is revoked", () => {
    const result = evaluateConsentGate({
      ...baseInput,
      sessionStatus: "REVOKED"
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SESSION_INACTIVE");
  });

  it("blocks when proposal cap is exceeded", () => {
    const result = evaluateConsentGate({
      ...baseInput,
      currentProposalCount: 3,
      maxProposals: 3
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CAP_EXCEEDED");
  });

  it("blocks when duplicate proposal exists", () => {
    const result = evaluateConsentGate({
      ...baseInput,
      duplicateFingerprintExists: true
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DUPLICATE_PROPOSAL");
  });

  it("blocks when wearer source image is missing", () => {
    const result = evaluateConsentGate({
      ...baseInput,
      hasSourceImage: false
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("INVALID_SOURCE_IMAGE");
  });
});

describe("Error Taxonomy", () => {
  it("maps YouCam multiple persons error to clear single-person instruction", () => {
    const error = mapYouCamError("MultiplePersonsFound");
    expect(error.code).toBe("MULTIPLE_PERSONS");
    expect(error.userMessage).toContain("Multiple individuals");
    expect(error.actionableStep).toContain("exactly one person");
    expect(error.isRetryable).toBe(false);
  });

  it("maps rate limiting gracefully as retryable", () => {
    const error = mapYouCamError("RateLimited");
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.isRetryable).toBe(true);
  });
});
