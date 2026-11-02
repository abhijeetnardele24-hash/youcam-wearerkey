import { config } from "../../config.js";
import type { ClothesTryOnProvider } from "./types.js";
import { YouCamClothesProvider } from "./youcam-provider.js";
import { FakeYouCamProvider } from "./fake-provider.js";
import { RecordedReceiptProvider } from "./recorded-provider.js";

export * from "./types.js";
export * from "./provenance.js";
export * from "./youcam-provider.js";
export * from "./fake-provider.js";
export * from "./recorded-provider.js";

let providerInstance: ClothesTryOnProvider | null = null;

export function getProvider(override?: ClothesTryOnProvider): ClothesTryOnProvider {
  if (override) {
    return override;
  }
  if (providerInstance) {
    return providerInstance;
  }

  if (config.YOUCAM_PROVIDER_MODE === "LIVE_YOUCAM" && config.YOUCAM_API_KEY) {
    providerInstance = new YouCamClothesProvider(config.YOUCAM_BASE_URL, config.YOUCAM_API_KEY);
  } else if (config.YOUCAM_PROVIDER_MODE === "RECORDED_LIVE_RESULT") {
    const recorded = new RecordedReceiptProvider();
    providerInstance = recorded.mode === "RECORDED_LIVE_RESULT" ? recorded : new FakeYouCamProvider();
  } else {
    providerInstance = new FakeYouCamProvider();
  }

  return providerInstance;
}
