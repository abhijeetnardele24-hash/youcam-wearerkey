import type {
  ConsentGateResult,
  GarmentCategory,
  SessionStatus
} from "@wearerkey/contracts";

export interface ConsentGateEvaluationInput {
  sessionStatus: SessionStatus;
  expiresAt: Date | string;
  allowedCategories: GarmentCategory[];
  garmentCategory: GarmentCategory;
  maxProposals: number;
  currentProposalCount: number;
  hasSourceImage: boolean;
  hasGarmentImage: boolean;
  duplicateFingerprintExists: boolean;
  isBudgetAvailable?: boolean;
}

export function evaluateConsentGate(input: ConsentGateEvaluationInput): ConsentGateResult {
  const now = new Date();
  const expiry = new Date(input.expiresAt);

  // 1. Session Expiry Check
  if (now >= expiry || input.sessionStatus === "EXPIRED") {
    return {
      allowed: false,
      code: "SESSION_EXPIRED",
      reason: "This Try-On Pass has expired. Ask the wearer to generate a fresh link."
    };
  }

  // 2. Session Active State Check
  if (input.sessionStatus === "REVOKED") {
    return {
      allowed: false,
      code: "SESSION_INACTIVE",
      reason: "This Try-On Pass has been revoked by the wearer."
    };
  }

  if (input.sessionStatus !== "ACTIVE" && input.sessionStatus !== "READY") {
    return {
      allowed: false,
      code: "SESSION_INACTIVE",
      reason: `Try-On Pass is not ready for proposals (current status: ${input.sessionStatus}).`
    };
  }

  // 3. Source Image Readiness Check
  if (!input.hasSourceImage) {
    return {
      allowed: false,
      code: "INVALID_SOURCE_IMAGE",
      reason: "The wearer has not yet uploaded a verified source photo for this Try-On Pass."
    };
  }

  // 4. Garment Image Readiness Check
  if (!input.hasGarmentImage) {
    return {
      allowed: false,
      code: "INVALID_GARMENT_IMAGE",
      reason: "Please attach a valid garment image (JPG/PNG under 10MB) for virtual try-on."
    };
  }

  // 5. Allowed Garment Category Check
  if (!input.allowedCategories.includes(input.garmentCategory)) {
    const allowedFormatted = input.allowedCategories.join(", ");
    return {
      allowed: false,
      code: "CATEGORY_NOT_ALLOWED",
      reason: `The wearer only consented to proposals for: [${allowedFormatted}]. '${input.garmentCategory}' is not permitted.`
    };
  }

  // 6. Proposal Cap Check
  if (input.currentProposalCount >= input.maxProposals) {
    return {
      allowed: false,
      code: "CAP_EXCEEDED",
      reason: `Proposal cap of ${input.maxProposals} reached for this Try-On Pass. The wearer must grant additional slots.`
    };
  }

  // 7. Duplicate Proposal Idempotency Check
  if (input.duplicateFingerprintExists) {
    return {
      allowed: false,
      code: "DUPLICATE_PROPOSAL",
      reason: "An identical garment proposal is already processing or completed for this session."
    };
  }

  // 8. Unit Budget Availability
  if (input.isBudgetAvailable === false) {
    return {
      allowed: false,
      code: "BUDGET_EXHAUSTED",
      reason: "The system demo budget is currently exhausted. Please contact the administrator."
    };
  }

  // All checks passed!
  return {
    allowed: true,
    code: "OK",
    reason: "Consent and readiness verified. Try-on generation authorized."
  };
}
