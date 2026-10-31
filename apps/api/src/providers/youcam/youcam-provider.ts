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
    return { units: 2, currency: "UNITS" };
  }

  /**
   * Upload image using official /s2s/v2.0/file presigned upload protocol:
   * 1. Send files array [{ content_type, file_name, file_size }]
   * 2. Receive file_id and presigned upload request URL/headers
   * 3. Upload sanitized bytes directly to the designated presigned endpoint
   */
  async uploadImage(image: SanitizedImage, _purpose: "source" | "garment"): Promise<ProviderFile> {
    const ext = image.mimeType === "image/png" ? "png" : "jpg";
    const filename = `wearerkey_${image.contentHash.slice(0, 16)}.${ext}`;

    const initPayload = {
      files: [
        {
          content_type: image.mimeType,
          file_name: filename,
          file_size: image.buffer.length
        }
      ]
    };

    const initRes = await request(`${this.baseUrl}/s2s/v2.0/file`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(initPayload)
    });

    if (initRes.statusCode !== 200 && initRes.statusCode !== 201) {
      const errText = await initRes.body.text();
      throw new Error(`YouCam File API initialization failed (${initRes.statusCode}): ${errText}`);
    }

    const initData: any = await initRes.body.json();

    // Parse official nested format or fallback
    let fileId: string | undefined;
    let uploadUrl: string | undefined;
    let uploadMethod = "PUT";
    let uploadHeaders: Record<string, string> = {};

    if (initData?.data?.files?.[0]) {
      const fileEntry = initData.data.files[0];
      fileId = fileEntry.file_id;
      if (fileEntry.requests?.[0]) {
        uploadUrl = fileEntry.requests[0].url;
        uploadMethod = fileEntry.requests[0].method || "PUT";
        uploadHeaders = fileEntry.requests[0].headers || {};
      }
    } else if (initData?.file_id) {
      fileId = initData.file_id;
      uploadUrl = initData.upload_url;
    }

    if (!fileId || !uploadUrl) {
      throw new Error(`Malformed response from YouCam File API: missing file_id or upload_url`);
    }

    // Upload sanitized bytes to presigned URL
    const mergedHeaders: Record<string, string> = {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.buffer.length),
      ...uploadHeaders
    };

    const uploadRes = await request(uploadUrl, {
      method: uploadMethod as any,
      headers: mergedHeaders,
      body: image.buffer
    });

    if (uploadRes.statusCode < 200 || uploadRes.statusCode >= 300) {
      const errText = await uploadRes.body.text();
      throw new Error(`YouCam presigned bytes upload failed (${uploadRes.statusCode}): ${errText}`);
    }

    return {
      fileId,
      contentHash: image.contentHash
    };
  }

  /**
   * Create asynchronous Clothes V4 task
   */
  async createTask(input: ClothesTaskInput): Promise<ProviderTask> {
    const payload: Record<string, any> = {
      src_file_id: input.srcFileId,
      ref_file_id: input.refFileId,
      garment_category: input.garmentCategory,
      filter_multi_person: input.filterMultiPerson || "strict"
    };

    if (input.changeShoes !== undefined) {
      payload.change_shoes = input.changeShoes;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    };

    if (input.idempotencyKey) {
      headers["Idempotency-Key"] = input.idempotencyKey;
    }

    const res = await request(`${this.baseUrl}/s2s/v2.0/task/cloth-v4`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (res.statusCode !== 200 && res.statusCode !== 202) {
      const errText = await res.body.text();
      throw new Error(`YouCam Clothes V4 task creation failed (${res.statusCode}): ${errText}`);
    }

    const json: any = await res.body.json();
    const taskId = json?.data?.task_id || json?.task_id;

    if (!taskId) {
      throw new Error(`YouCam Clothes V4 task response missing task_id`);
    }

    return {
      taskId,
      status: "SUBMITTED",
      estimatedUnits: 2
    };
  }

  /**
   * Poll task status with exponential backoff and jitter
   */
  async pollTask(taskId: string, timeoutMs = 60000): Promise<ProviderTaskStatus> {
    const startTime = Date.now();
    let currentDelayMs = 1500;
    const maxDelayMs = 5000;

    while (Date.now() - startTime < timeoutMs) {
      // Respect rate-limits and backoff with small random jitter (0 to 300ms)
      const jitter = Math.floor(Math.random() * 300);
      await new Promise((resolve) => setTimeout(resolve, currentDelayMs + jitter));

      let res;
      try {
        res = await request(`${this.baseUrl}/s2s/v2.0/task/cloth-v4/${encodeURIComponent(taskId)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json"
          }
        });
      } catch (err: any) {
        // Fallback query parameter variant if path-param returns network or 404
        try {
          res = await request(`${this.baseUrl}/s2s/v2.0/task/cloth-v4?task_id=${encodeURIComponent(taskId)}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              Accept: "application/json"
            }
          });
        } catch (innerErr: any) {
          return {
            taskId,
            status: "FAILED",
            errorCode: "NETWORK_ERROR",
            errorMessage: `Network error polling YouCam task: ${innerErr.message}`
          };
        }
      }

      if (res.statusCode === 429) {
        // Rate-limited: back off and retry
        const retryAfterHeader = res.headers["retry-after"];
        const retrySeconds = retryAfterHeader ? parseInt(String(retryAfterHeader), 10) : 5;
        await new Promise((r) => setTimeout(r, (retrySeconds || 5) * 1000));
        continue;
      }

      if (res.statusCode !== 200) {
        const errText = await res.body.text();
        return {
          taskId,
          status: "FAILED",
          errorCode: `HTTP_${res.statusCode}`,
          errorMessage: `YouCam status check failed: ${errText}`
        };
      }

      let data: any;
      try {
        data = await res.body.json();
      } catch {
        return {
          taskId,
          status: "FAILED",
          errorCode: "MALFORMED_RESPONSE",
          errorMessage: "YouCam returned unparseable JSON"
        };
      }

      const taskStatus = (data?.data?.task_status || data?.task_status || data?.status || "").toUpperCase();

      // Support official documented successful response containing data.results.url, with defensive parsing
      let resultUrl: string | undefined;
      if (typeof data?.data?.results?.url === "string") {
        resultUrl = data.data.results.url;
      } else if (Array.isArray(data?.data?.results) && typeof data.data.results[0]?.url === "string") {
        resultUrl = data.data.results[0].url;
      } else if (typeof data?.data?.result_url === "string") {
        resultUrl = data.data.result_url;
      } else if (typeof data?.results?.url === "string") {
        resultUrl = data.results.url;
      } else if (Array.isArray(data?.results) && typeof data.results[0]?.url === "string") {
        resultUrl = data.results[0].url;
      } else if (typeof data?.result_url === "string") {
        resultUrl = data.result_url;
      }

      if (taskStatus === "SUCCESS" || taskStatus === "SUCCEEDED") {
        if (!resultUrl) {
          return {
            taskId,
            status: "FAILED",
            errorCode: "EMPTY_RESULT_URL",
            errorMessage: "Task reported success but returned no result URL"
          };
        }
        return {
          taskId,
          status: "SUCCEEDED",
          resultUrl,
          observedUnits: 2
        };
      }

      if (taskStatus === "FAILED" || taskStatus === "ERROR") {
        const errorCode = data?.data?.error_code || data?.error_code || "PROVIDER_ERROR";
        const errorMessage = data?.data?.error || data?.error || data?.message || "Task failed on provider side";
        return {
          taskId,
          status: "FAILED",
          errorCode,
          errorMessage
        };
      }

      // Exponential backoff
      currentDelayMs = Math.min(currentDelayMs * 1.5, maxDelayMs);
    }

    return {
      taskId,
      status: "FAILED",
      errorCode: "Timeout",
      errorMessage: `Generation timed out after ${timeoutMs / 1000}s`
    };
  }

  /**
   * Delete remote task and all associated input files & outputs using official Perfect Corp POST /s2s/v2.0/task/delete
   */
  async deleteTask(taskId: string): Promise<ProviderDeletionResult> {
    try {
      const res = await request(`${this.baseUrl}/s2s/v2.0/task/delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ task_id: taskId })
      });

      const bodyText = await res.body.text();
      let bodyJson: any = null;
      try {
        bodyJson = JSON.parse(bodyText);
      } catch {
        // malformed / non-JSON response
      }

      // Official Perfect Corp Task Management contract: HTTP 200 with JSON { "status": 200 }
      const isConfirmed =
        res.statusCode === 200 &&
        (bodyJson?.status === 200 ||
          bodyJson?.status === "success" ||
          bodyJson?.status === "SUCCESS" ||
          bodyJson?.success === true);

      if (isConfirmed) {
        return {
          taskId,
          confirmed: true,
          providerStatus: "DELETED",
          deletionMode: "GENUINE_PROVIDER_CONFIRMED",
          rawResponse: bodyJson || { statusCode: 200 }
        };
      }

      return {
        taskId,
        confirmed: false,
        providerStatus: "FAILED",
        deletionMode: "NOT_LIVE_VERIFIED",
        rawResponse: { statusCode: res.statusCode, body: bodyText, parsed: bodyJson }
      };
    } catch (err: any) {
      return {
        taskId,
        confirmed: false,
        providerStatus: "FAILED",
        deletionMode: "NOT_LIVE_VERIFIED",
        rawResponse: { error: err.message }
      };
    }
  }

  /**
   * Delete remote uploaded file using DELETE /s2s/v2.0/file/{fileId}
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const res = await request(`${this.baseUrl}/s2s/v2.0/file/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.apiKey}`
        }
      });
      return res.statusCode === 200 || res.statusCode === 204;
    } catch {
      return false;
    }
  }
}
