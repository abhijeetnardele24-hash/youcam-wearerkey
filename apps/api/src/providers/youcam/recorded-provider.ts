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
import { verifyRecordedResultProvenance, type RecordedProvenanceCheckResult } from "./provenance.js";

export class RecordedReceiptProvider implements ClothesTryOnProvider {
  readonly mode: "RECORDED_LIVE_RESULT" | "DEMO_FIXTURE";
  private readonly verificationResult: RecordedProvenanceCheckResult;
  private readonly recordedResultUrl: string;
  private readonly recordedTaskId: string;

  constructor(options?: {
    rootDir?: string;
    manifestPath?: string;
    recordedResultUrl?: string; // Explicitly ignored to prevent arbitrary URL override
    recordedTaskId?: string; // Explicitly ignored to prevent arbitrary task ID override
  }) {
    this.verificationResult = verifyRecordedResultProvenance({
      rootDir: options?.rootDir,
      manifestPath: options?.manifestPath
    });

    if (this.verificationResult.valid && this.verificationResult.manifest && this.verificationResult.resultUrl) {
      this.mode = "RECORDED_LIVE_RESULT";
      // Derive STRICTLY from verified provenance only - ignore any arbitrary overrides
      this.recordedResultUrl = this.verificationResult.resultUrl;
      this.recordedTaskId = `recorded_task_${this.verificationResult.manifest.task_id_hash.slice(0, 16)}`;
    } else {
      // Evidence gate: If verification fails, force DEMO_FIXTURE
      this.mode = "DEMO_FIXTURE";
      this.recordedResultUrl = "/assets/sample_vto_result.png";
      this.recordedTaskId = "judge_fixture_task_v4";
    }
  }

  getProvenanceCheck(): RecordedProvenanceCheckResult {
    return this.verificationResult;
  }

  getRecordedResultUrl(): string {
    return this.recordedResultUrl;
  }

  getRecordedTaskId(): string {
    return this.recordedTaskId;
  }

  async checkCost(_category: GarmentCategory): Promise<{ units: number; currency: string }> {
    return { units: 2, currency: "UNITS" };
  }

  async uploadImage(image: SanitizedImage, _purpose: "source" | "garment"): Promise<ProviderFile> {
    return {
      fileId: `recorded_file_${image.contentHash.slice(0, 16)}`,
      fileUrl: `/assets/sample_garment_overcoat.png`,
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
      confirmed: false,
      providerStatus: "DELETED",
      deletionMode: "SIMULATED"
    };
  }

  async deleteFile(_fileId: string): Promise<boolean> {
    return true;
  }
}
