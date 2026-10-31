import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from "undici";
import { YouCamClothesProvider } from "../../apps/api/src/providers/youcam/youcam-provider.js";
import type { SanitizedImage } from "../../apps/api/src/services/image-sanitizer.js";

describe("YouCamClothesProvider Contract Tests", () => {
  let mockAgent: MockAgent;
  let originalDispatcher: any;
  const baseUrl = "https://mock.youcam.api";
  const apiKey = "test_youcam_api_key_12345";
  let provider: YouCamClothesProvider;

  const sampleImage: SanitizedImage = {
    buffer: Buffer.from("fake-png-data"),
    mimeType: "image/png",
    width: 800,
    height: 1000,
    byteSize: 13,
    contentHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  };

  beforeEach(() => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    provider = new YouCamClothesProvider(baseUrl, apiKey);
  });

  afterEach(() => {
    setGlobalDispatcher(originalDispatcher);
  });

  it("throws if instantiated without API key", () => {
    expect(() => new YouCamClothesProvider(baseUrl, "")).toThrow(
      "YouCamClothesProvider requires a valid server-side YOUCAM_API_KEY"
    );
  });

  it("returns estimated units for garment categories", async () => {
    const cost = await provider.checkCost("outer");
    expect(cost.units).toBe(2);
    expect(cost.currency).toBe("UNITS");
  });

  describe("uploadImage (Presigned S2S Protocol)", () => {
    it("successfully completes official /s2s/v2.0/file protocol and presigned PUT", async () => {
      const client = mockAgent.get(baseUrl);

      client
        .intercept({
          path: "/s2s/v2.0/file",
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          }
        })
        .reply(200, {
          data: {
            files: [
              {
                file_id: "youcam_file_uuid_999",
                file_name: "wearerkey_abcdef1234567890.png",
                requests: [
                  {
                    url: "https://mock.upload.cdn/presigned/wearerkey_abcdef1234567890.png",
                    method: "PUT",
                    headers: {
                      "x-custom-cdn-header": "valid"
                    }
                  }
                ]
              }
            ]
          }
        });

      const uploadClient = mockAgent.get("https://mock.upload.cdn");
      uploadClient
        .intercept({
          path: "/presigned/wearerkey_abcdef1234567890.png",
          method: "PUT"
        })
        .reply(200, "");

      const result = await provider.uploadImage(sampleImage, "source");
      expect(result.fileId).toBe("youcam_file_uuid_999");
      expect(result.contentHash).toBe(sampleImage.contentHash);
    });

    it("throws clear error when /s2s/v2.0/file rejects request (401 Unauthorized)", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/file",
          method: "POST"
        })
        .reply(401, JSON.stringify({ error: "UNAUTHORIZED", message: "Invalid API key" }));

      await expect(provider.uploadImage(sampleImage, "source")).rejects.toThrow(
        "YouCam File API initialization failed (401)"
      );
    });

    it("throws clear error when presigned PUT upload fails (500 Server Error)", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/file",
          method: "POST"
        })
        .reply(200, {
          data: {
            files: [
              {
                file_id: "youcam_file_uuid_888",
                requests: [
                  {
                    url: "https://mock.upload.cdn/presigned/fail.png",
                    method: "PUT"
                  }
                ]
              }
            ]
          }
        });

      const uploadClient = mockAgent.get("https://mock.upload.cdn");
      uploadClient
        .intercept({
          path: "/presigned/fail.png",
          method: "PUT"
        })
        .reply(500, "Storage S3 service unavailable");

      await expect(provider.uploadImage(sampleImage, "garment")).rejects.toThrow(
        "YouCam presigned bytes upload failed (500)"
      );
    });
  });

  describe("createTask", () => {
    it("successfully submits Clothes V4 task with strict multiperson filter", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/cloth-v4",
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: (body: string) => {
            const parsed = JSON.parse(body);
            return (
              parsed.src_file_id === "src_file_1" &&
              parsed.ref_file_id === "ref_file_1" &&
              parsed.garment_category === "outer" &&
              parsed.filter_multi_person === "strict"
            );
          }
        })
        .reply(200, {
          data: {
            task_id: "youcam_task_v4_777",
            status: "SUBMITTED"
          }
        });

      const task = await provider.createTask({
        srcFileId: "src_file_1",
        refFileId: "ref_file_1",
        garmentCategory: "outer"
      });

      expect(task.taskId).toBe("youcam_task_v4_777");
      expect(task.status).toBe("SUBMITTED");
      expect(task.estimatedUnits).toBe(2);
    });

    it("throws when task creation fails (400 Bad Request)", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/cloth-v4",
          method: "POST"
        })
        .reply(400, JSON.stringify({ error: "INVALID_CATEGORY" }));

      await expect(
        provider.createTask({
          srcFileId: "src_file_1",
          refFileId: "ref_file_1",
          garmentCategory: "outer"
        })
      ).rejects.toThrow("YouCam Clothes V4 task creation failed (400)");
    });
  });

  describe("pollTask", () => {
    it("supports official documented successful response containing data.results.url", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/cloth-v4/task_success_official",
          method: "GET"
        })
        .reply(200, {
          data: {
            task_status: "SUCCESS",
            results: {
              url: "https://mock.youcam.cdn/results/official_url_structure.png"
            }
          }
        });

      const status = await provider.pollTask("task_success_official", 5000);
      expect(status.status).toBe("SUCCEEDED");
      expect(status.resultUrl).toBe("https://mock.youcam.cdn/results/official_url_structure.png");
      expect(status.observedUnits).toBe(2);
    });

    it("supports array results fallback (data.results[0].url)", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/cloth-v4/task_success_array",
          method: "GET"
        })
        .reply(200, {
          data: {
            task_status: "SUCCESS",
            results: [
              {
                url: "https://mock.youcam.cdn/results/array_url_structure.png"
              }
            ]
          }
        });

      const status = await provider.pollTask("task_success_array", 5000);
      expect(status.status).toBe("SUCCEEDED");
      expect(status.resultUrl).toBe("https://mock.youcam.cdn/results/array_url_structure.png");
    });

    it("returns FAILED when provider reports failure with specific error code", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/cloth-v4/task_fail_456",
          method: "GET"
        })
        .reply(200, {
          data: {
            task_status: "FAILED",
            error_code: "NO_PERSON_DETECTED",
            error: "Could not detect a clear human body in source photo"
          }
        });

      const status = await provider.pollTask("task_fail_456", 5000);
      expect(status.status).toBe("FAILED");
      expect(status.errorCode).toBe("NO_PERSON_DETECTED");
      expect(status.errorMessage).toContain("human body");
    });

    it("returns FAILED with EMPTY_RESULT_URL when success status has no result URL", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/cloth-v4/task_no_url",
          method: "GET"
        })
        .reply(200, {
          data: {
            task_status: "SUCCESS",
            results: {}
          }
        });

      const status = await provider.pollTask("task_no_url", 5000);
      expect(status.status).toBe("FAILED");
      expect(status.errorCode).toBe("EMPTY_RESULT_URL");
    });

    it("handles malformed non-JSON response gracefully", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/cloth-v4/task_bad_json",
          method: "GET"
        })
        .reply(200, "<html><body>502 Bad Gateway</body></html>", {
          headers: { "content-type": "text/html" }
        });

      const status = await provider.pollTask("task_bad_json", 5000);
      expect(status.status).toBe("FAILED");
      expect(status.errorCode).toBe("MALFORMED_RESPONSE");
    });

    it("handles polling timeout", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/cloth-v4/task_slow",
          method: "GET"
        })
        .reply(200, {
          data: {
            task_status: "PROCESSING"
          }
        })
        .persist();

      const status = await provider.pollTask("task_slow", 500); // 500ms timeout
      expect(status.status).toBe("FAILED");
      expect(status.errorCode).toBe("Timeout");
    });
  });

  describe("deleteTask and deleteFile", () => {
    it("deletes task and associated files via official POST /s2s/v2.0/task/delete with status: 200", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/delete",
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          }
        })
        .reply(200, { status: 200 });

      const res = await provider.deleteTask("task_to_delete_999");
      expect(res.confirmed).toBe(true);
      expect(res.providerStatus).toBe("DELETED");
      expect(res.deletionMode).toBe("GENUINE_PROVIDER_CONFIRMED");
    });

    it("rejects confirmation if provider returns HTTP 200 with non-200 status payload", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/delete",
          method: "POST"
        })
        .reply(200, { status: 400, error: "TASK_NOT_FOUND" });

      const res = await provider.deleteTask("task_not_found_123");
      expect(res.confirmed).toBe(false);
      expect(res.providerStatus).toBe("FAILED");
    });

    it("handles unconfirmed task deletion when provider returns 500 HTTP error", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/task/delete",
          method: "POST"
        })
        .reply(500, "Internal Server Error");

      const res = await provider.deleteTask("task_fail_delete");
      expect(res.confirmed).toBe(false);
      expect(res.providerStatus).toBe("FAILED");
    });

    it("deletes file via DELETE /s2s/v2.0/file/{fileId}", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/file/file_to_delete_888",
          method: "DELETE",
          headers: {
            authorization: `Bearer ${apiKey}`
          }
        })
        .reply(200, "");

      const success = await provider.deleteFile("file_to_delete_888");
      expect(success).toBe(true);
    });

    it("returns false when delete file fails", async () => {
      const client = mockAgent.get(baseUrl);
      client
        .intercept({
          path: "/s2s/v2.0/file/file_fail",
          method: "DELETE"
        })
        .reply(404, "Not Found");

      const success = await provider.deleteFile("file_fail");
      expect(success).toBe(false);
    });
  });
});
