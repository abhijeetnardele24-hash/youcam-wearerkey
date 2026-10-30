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

export class FakeYouCamProvider implements ClothesTryOnProvider {
  readonly mode = "DEMO_FIXTURE" as const;

  private files = new Map<string, ProviderFile>();
  private tasks = new Map<string, ProviderTaskStatus>();
  private deletedTasks = new Set<string>();

  constructor(
    private readonly defaultDelayMs = 50,
    private readonly simulatedError: string | null = null
  ) {}

  async checkCost(_category: GarmentCategory): Promise<{ units: number; currency: string }> {
    return { units: 2, currency: "UNITS" };
  }

  async uploadImage(image: SanitizedImage, _purpose: "source" | "garment"): Promise<ProviderFile> {
    const fileId = `fake_file_${image.contentHash.slice(0, 16)}`;
    const providerFile: ProviderFile = {
      fileId,
      fileUrl: `https://fake.youcam.local/files/${fileId}`,
      contentHash: image.contentHash
    };
    this.files.set(fileId, providerFile);
    return providerFile;
  }

  async createTask(input: ClothesTaskInput): Promise<ProviderTask> {
    const taskId = `fake_task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (this.simulatedError) {
      this.tasks.set(taskId, {
        taskId,
        status: "FAILED",
        errorCode: this.simulatedError,
        errorMessage: `Simulated error: ${this.simulatedError}`
      });
    } else {
      this.tasks.set(taskId, {
        taskId,
        status: "SUCCEEDED",
        resultUrl: `https://fake.youcam.local/results/${taskId}.jpg`,
        observedUnits: 2
      });
    }

    return {
      taskId,
      status: "SUBMITTED",
      estimatedUnits: 2
    };
  }

  async pollTask(taskId: string): Promise<ProviderTaskStatus> {
    if (this.defaultDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.defaultDelayMs));
    }
    const status = this.tasks.get(taskId);
    if (!status) {
      return {
        taskId,
        status: "FAILED",
        errorCode: "NOT_FOUND",
        errorMessage: `Task ${taskId} not found`
      };
    }
    return status;
  }

  async deleteTask(taskId: string): Promise<ProviderDeletionResult> {
    this.deletedTasks.add(taskId);
    this.tasks.delete(taskId);
    return {
      taskId,
      confirmed: true,
      providerStatus: "DELETED"
    };
  }
}
