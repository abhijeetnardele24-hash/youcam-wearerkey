/**
 * Mapping of official YouCam AI Clothes VTO error codes to safe, actionable explanations.
 */
export interface SafeErrorInfo {
  code: string;
  userMessage: string;
  actionableStep: string;
  isRetryable: boolean;
}

export const YOUCAM_ERROR_MAP: Record<string, SafeErrorInfo> = {
  InvalidApiKey: {
    code: "AUTHENTICATION_FAILED",
    userMessage: "YouCam API key is invalid or unrecognized.",
    actionableStep: "Verify server-side YOUCAM_API_KEY configuration.",
    isRetryable: false
  },
  MultiplePersonsFound: {
    code: "MULTIPLE_PERSONS",
    userMessage: "Multiple individuals detected in the uploaded photo.",
    actionableStep: "Please upload a clear photo containing exactly one person (strict privacy rule).",
    isRetryable: false
  },
  NoPersonFound: {
    code: "NO_PERSON_FOUND",
    userMessage: "No person detected in the wearer photo.",
    actionableStep: "Ensure the photo clearly displays a forward-facing full-body or upper-body person.",
    isRetryable: false
  },
  InvalidImageResolution: {
    code: "RESOLUTION_INVALID",
    userMessage: "Image dimensions do not meet YouCam requirements.",
    actionableStep: "Upload an image with minimum 512x512 px resolution.",
    isRetryable: false
  },
  ImageSizeTooLarge: {
    code: "FILE_TOO_LARGE",
    userMessage: "Uploaded image exceeds 10MB limit.",
    actionableStep: "Compress image or upload a smaller file under 10MB.",
    isRetryable: false
  },
  GarmentCategoryMismatch: {
    code: "CATEGORY_MISMATCH",
    userMessage: "The garment image does not match the selected category.",
    actionableStep: "Ensure the reference garment clearly matches the chosen category (e.g. upper body, outer, etc.).",
    isRetryable: false
  },
  ContentFilterRejected: {
    code: "CONTENT_FLAGGED",
    userMessage: "Image content was flagged by automated safety filters.",
    actionableStep: "Please upload appropriate apparel and model imagery.",
    isRetryable: false
  },
  InsufficientBalance: {
    code: "UNITS_EXHAUSTED",
    userMessage: "YouCam developer unit balance is depleted.",
    actionableStep: "Top up unit balance or switch to demo recorded replay mode.",
    isRetryable: false
  },
  RateLimited: {
    code: "RATE_LIMITED",
    userMessage: "YouCam API request rate limit exceeded.",
    actionableStep: "Please wait 10 seconds before submitting another try-on request.",
    isRetryable: true
  },
  Timeout: {
    code: "TASK_TIMEOUT",
    userMessage: "Try-on generation timed out after maximum polling interval.",
    actionableStep: "The provider is experiencing high load. Please try again in a moment.",
    isRetryable: true
  }
};

export function mapYouCamError(rawErrorCode: string | null | undefined, fallbackMessage?: string): SafeErrorInfo {
  if (!rawErrorCode) {
    return {
      code: "UNKNOWN_PROVIDER_ERROR",
      userMessage: fallbackMessage || "An unexpected error occurred during virtual try-on.",
      actionableStep: "Please check your network and try again.",
      isRetryable: true
    };
  }

  const mapped = YOUCAM_ERROR_MAP[rawErrorCode];
  if (mapped) {
    return mapped;
  }

  return {
    code: rawErrorCode.toUpperCase(),
    userMessage: fallbackMessage || `Virtual try-on processing failed (${rawErrorCode}).`,
    actionableStep: "Please verify input images and try again.",
    isRetryable: true
  };
}
