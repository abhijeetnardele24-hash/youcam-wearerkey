import type { FastifyPluginAsync } from "fastify";
import { execSync } from "node:child_process";
import { config } from "../config.js";
import { getProvider } from "../providers/youcam/index.js";
import { GarmentCategorySchema } from "@wearerkey/contracts";

function getCommitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8", timeout: 1500 }).trim();
  } catch {
    return process.env.GIT_COMMIT_SHA || "unknown";
  }
}

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const commitSha = getCommitSha();
  const provider = getProvider();

  fastify.get("/api/health", async (_req, reply) => {
    return reply.send({
      status: "ok",
      app: "WearerKey API",
      version: "1.0.0",
      commit: commitSha,
      environment: config.NODE_ENV,
      provider_mode: provider.mode,
      database: config.DATABASE_URL ? "connected" : "embedded",
      timestamp: new Date().toISOString()
    });
  });

  fastify.get("/api/meta", async (_req, reply) => {
    return reply.send({
      app: "WearerKey",
      version: "1.0.0",
      commit: commitSha,
      provider_mode: provider.mode,
      api_host: config.YOUCAM_BASE_URL,
      supported_categories: GarmentCategorySchema.options,
      max_proposals_limit: 10,
      features: {
        gift_mode: true,
        deletion_receipts: true,
        judge_tour: true,
        sse_updates: true
      },
      safety_disclaimer: "Visual appearance preview—not size or physical-fit prediction."
    });
  });
};
