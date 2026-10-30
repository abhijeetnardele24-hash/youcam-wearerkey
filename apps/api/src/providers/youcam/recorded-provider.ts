import type { GarmentCategory } from "@wearerkey/contracts";
import type {
  ClothesTryOnProvider,
  ClothesTaskInput,
  ProviderFile,
  ProviderTask,
  ProviderTaskStatus,
  ProviderDeletionResult
} from "./types.js";
import type { SanitizedImage } from "../../services/image-sanitizer.js";

export class RecordedReceiptProvider implements ClothesTryOnProvider {
  readonly mode = "RECORDED_LIVE_RESULT" as const;

  constructor(
    private readonly recordedResultUrl: string = "/assets/sample_vto_result.png",
    private readonly recordedTaskId: string = "recorded_live_task_youcam_v4_sample"
  ) {}

  async checkCost(_category: GarmentCategory): Promise<{ units: number; currency: string }> {
    return { units: 2, currency: "UNITS" };
  }

  async uploadImage(image: SanitizedImage, _purpose: "source" | "garment"): Promise<ProviderFile> {
    return {
      fileId: `recorded_file_${image.contentHash.slice(0, 16)}`,
      fileUrl: `/assets/recorded_upload.jpg`,
      contentHash: image.contentHash
    };
  }

  async createTask(_input: ClothesTaskInput): Promise<ProviderTask> {
    return {
      taskId: this.recordedTaskId,
      status: "SUBMITTED",
      estimatedUnits: 2
    };
  }

  async pollTask(taskId: string): Promise<ProviderTaskStatus> {
    return {
      taskId,
      status: "SUCCEEDED",
      resultUrl: this.recordedResultUrl,
      observedUnits: 2
    };
  }

  async deleteTask(taskId: string): Promise<ProviderDeletionResult> {
    return {
      taskId,
      confirmed: true,
      providerStatus: "DELETED"
    };
  }
}
