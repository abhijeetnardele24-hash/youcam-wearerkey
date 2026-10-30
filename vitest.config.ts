import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage"
    }
  },
  resolve: {
    alias: {
      "@wearerkey/contracts": path.resolve(__dirname, "packages/contracts/src/index.ts"),
      "@wearerkey/domain": path.resolve(__dirname, "packages/domain/src/index.ts")
    }
  }
});
