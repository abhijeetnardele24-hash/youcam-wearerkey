import type { GarmentCategory, ProviderMode } from "@wearerkey/contracts";
import type { SanitizedImage } from "../../services/image-sanitizer.js";

export interface ProviderFile {
  fileId: string;
  fileUrl?: string;
  contentHash: string;
}

export interface ClothesTaskInput {
  srcFileId: string;
  refFileId: string;
  garmentCategory: GarmentCategory;
  changeShoes?: boolean;
  filterMultiPerson?: "strict" | "loose";
  idempotencyKey?: string;
}

export interface ProviderTask {
  taskId: string;
  status: "SUBMITTED" | "PROCESSING" | "SUCCEEDED" | "FAILED";
  estimatedUnits: number;
}

export interface ProviderTaskStatus {
  taskId: string;
  status: "PROCESSING" | "SUCCEEDED" | "FAILED";
  resultUrl?: string;
  observedUnits?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface ProviderDeletionResult {
  taskId: string;
  confirmed: boolean;
  providerStatus: "DELETED" | "FAILED" | "NOT_SUPPORTED";
  rawResponse?: Record<string, unknown>;
}

export interface ClothesTryOnProvider {
  readonly mode: ProviderMode;
  checkCost(category: GarmentCategory): Promise<{ units: number; currency: string }>;
  uploadImage(image: SanitizedImage, purpose: "source" | "garment"): Promise<ProviderFile>;
  createTask(input: ClothesTaskInput): Promise<ProviderTask>;
  pollTask(taskId: string, timeoutMs?: number): Promise<ProviderTaskStatus>;
  deleteTask(taskId: string): Promise<ProviderDeletionResult>;
  deleteFile(fileId: string): Promise<boolean>;
}
