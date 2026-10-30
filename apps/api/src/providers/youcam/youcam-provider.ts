import { request } from "undici";
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

export class YouCamClothesProvider implements ClothesTryOnProvider {
  readonly mode = "LIVE_YOUCAM" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {
    if (!apiKey) {
      throw new Error("YouCamClothesProvider requires a valid server-side YOUCAM_API_KEY");
    }
  }

  async checkCost(_category: GarmentCategory): Promise<{ units: number; currency: string }> {
    // Official YouCam AI Clothes V2/V3/V4 standard unit consumption: 2 units per successful generation
    return { units: 2, currency: "UNITS" };
  }

  async uploadImage(image: SanitizedImage, _purpose: "source" | "garment"): Promise<ProviderFile> {
    const ext = image.mimeType === "image/png" ? "png" : "jpg";
    const filename = `wearerkey_${image.contentHash.slice(0, 16)}.${ext}`;

    // Step 1: Request upload URL and file_id from File API
    const initRes = await request(`${this.baseUrl}/s2s/v2.0/file`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file_name: filename,
        file_type: image.mimeType
      })
    });

    if (initRes.statusCode !== 200) {
      const errText = await initRes.body.text();
      throw new Error(`YouCam File API initialization failed (${initRes.statusCode}): ${errText}`);
    }

    const initData = (await initRes.body.json()) as {
      file_id: string;
      upload_url: string;
    };

    // Step 2: Upload raw sanitized bytes to presigned upload URL
    const uploadRes = await request(initData.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": image.mimeType,
        "Content-Length": String(image.buffer.length)
      },
      body: image.buffer
    });

    if (uploadRes.statusCode < 200 || uploadRes.statusCode >= 300) {
      const errText = await uploadRes.body.text();
      throw new Error(`YouCam image bytes upload failed (${uploadRes.statusCode}): ${errText}`);
    }

    return {
      fileId: initData.file_id,
      contentHash: image.contentHash
    };
  }

  async createTask(input: ClothesTaskInput): Promise<ProviderTask> {
    const payload = {
      src_file_id: input.srcFileId,
      ref_file_id: input.refFileId,
      garment_category: input.garmentCategory,
      filter_multi_person: input.filterMultiPerson || "strict",
      change_shoes: input.changeShoes || false
    };

    const res = await request(`${this.baseUrl}/s2s/v2.0/task/cloth-v4`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {})
      },
      body: JSON.stringify(payload)
    });

    if (res.statusCode !== 200 && res.statusCode !== 202) {
      const errText = await res.body.text();
      throw new Error(`YouCam Clothes V4 task creation failed (${res.statusCode}): ${errText}`);
    }

    const data = (await res.body.json()) as {
      task_id: string;
      status?: string;
    };

    return {
      taskId: data.task_id,
      status: "SUBMITTED",
      estimatedUnits: 2
    };
  }

  async pollTask(taskId: string, timeoutMs = 90000): Promise<ProviderTaskStatus> {
    const startTime = Date.now();
    const intervalMs = 5000; // Poll every 5s

    while (Date.now() - startTime < timeoutMs) {
      const res = await request(`${this.baseUrl}/s2s/v2.0/task/cloth-v4?task_id=${encodeURIComponent(taskId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`
        }
      });

      if (res.statusCode !== 200) {
        const errText = await res.body.text();
        return {
          taskId,
          status: "FAILED",
          errorCode: `HTTP_${res.statusCode}`,
          errorMessage: errText
        };
      }

      const data = (await res.body.json()) as {
        status: string;
        result_url?: string;
        error?: string;
        error_code?: string;
      };

      if (data.status === "success" || data.status === "SUCCEEDED") {
        return {
          taskId,
          status: "SUCCEEDED",
          resultUrl: data.result_url,
          observedUnits: 2
        };
      }

      if (data.status === "error" || data.status === "FAILED") {
        return {
          taskId,
          status: "FAILED",
          errorCode: data.error_code || "PROVIDER_TASK_ERROR",
          errorMessage: data.error || "YouCam Clothes VTO generation failed."
        };
      }

      // Still processing, wait for next tick
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return {
      taskId,
      status: "FAILED",
      errorCode: "Timeout",
      errorMessage: `Generation timed out after ${timeoutMs / 1000}s`
    };
  }

  async deleteTask(taskId: string): Promise<ProviderDeletionResult> {
    try {
      const res = await request(`${this.baseUrl}/s2s/v2.0/task/cloth-v4?task_id=${encodeURIComponent(taskId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.apiKey}`
        }
      });

      if (res.statusCode === 200 || res.statusCode === 204) {
        return {
          taskId,
          confirmed: true,
          providerStatus: "DELETED"
        };
      }

      const errText = await res.body.text();
      return {
        taskId,
        confirmed: false,
        providerStatus: "FAILED",
        rawResponse: { statusCode: res.statusCode, body: errText }
      };
    } catch (err) {
      return {
        taskId,
        confirmed: false,
        providerStatus: "FAILED",
        rawResponse: { error: String(err) }
      };
    }
  }
}
