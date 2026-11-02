import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runClaimsCheck, REQUIRED_DOCS } from "../../scripts/check-claims.js";

describe("Fail-Closed Claims & Evidence Integrity Auditor", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "claims-test-"));
    const docsDir = path.join(tempDir, "docs");
    fs.mkdirSync(docsDir, { recursive: true });

    // Seed mock required docs
    for (const doc of REQUIRED_DOCS) {
      const fullPath = path.join(tempDir, doc);
      if (doc.endsWith(".json")) {
        fs.writeFileSync(
          fullPath,
          JSON.stringify({
            evaluated_commit_sha: "test_sha_clean",
            provider_mode: "DEMO_FIXTURE",
            live_execution_verified: false,
            evidence: {
              test_suites: {
                vitest_unit_and_integration: { total: 10, passed: 10 },
                playwright_browser_e2e: { total: 8, passed: 8 }
              }
            }
          })
        );
      } else {
        fs.writeFileSync(fullPath, "# Honest Document\nDeterministic test documentation.");
      }
    }

    // Seed passing test results
    fs.writeFileSync(
      path.join(docsDir, "vitest-results.json"),
      JSON.stringify({
        numTotalTests: 50,
        numPassedTests: 50,
        numFailedTests: 0,
        testResults: [{ name: "domain.test.ts" }]
      })
    );

    fs.writeFileSync(
      path.join(docsDir, "playwright-results.json"),
      JSON.stringify({
        stats: {
          expected: 10,
          unexpected: 0
        }
      })
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("passes when all documents, reports, and evidence are truthful and valid", () => {
    const res = runClaimsCheck({
      cwd: tempDir,
      strictSha: false
    });

    expect(res.passed).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.results?.verdict).toBe("INTERNAL_COMPLETE_EXTERNAL_ACTION_REQUIRED");
  });

  it("fails closed when any forbidden hyperbolic phrase is detected in documentation", () => {
    const readmePath = path.join(tempDir, "README.md");
    fs.writeFileSync(readmePath, "# WearerKey\nThis project is 100% safe to submit to judges!");

    const res = runClaimsCheck({
      cwd: tempDir,
      strictSha: false
    });

    expect(res.passed).toBe(false);
    expect(res.errors.some((e) => e.includes("100% safe to submit"))).toBe(true);
  });

  it("fails closed when a required documentation file is missing", () => {
    fs.unlinkSync(path.join(tempDir, "docs/THREAT_MODEL.md"));

    const res = runClaimsCheck({
      cwd: tempDir,
      strictSha: false
    });

    expect(res.passed).toBe(false);
    expect(res.errors.some((e) => e.includes("THREAT_MODEL.md"))).toBe(true);
  });

  it("fails closed when vitest-results.json has failing tests", () => {
    fs.writeFileSync(
      path.join(tempDir, "docs/vitest-results.json"),
      JSON.stringify({
        numTotalTests: 50,
        numPassedTests: 48,
        numFailedTests: 2
      })
    );

    const res = runClaimsCheck({
      cwd: tempDir,
      strictSha: false
    });

    expect(res.passed).toBe(false);
    expect(res.errors.some((e) => e.includes("2 failing tests"))).toBe(true);
  });

  it("fails closed when vitest-results.json is completely missing", () => {
    fs.unlinkSync(path.join(tempDir, "docs/vitest-results.json"));

    const res = runClaimsCheck({
      cwd: tempDir,
      strictSha: false
    });

    expect(res.passed).toBe(false);
    expect(res.errors.some((e) => e.includes("Missing docs/vitest-results.json"))).toBe(true);
  });

  it("fails closed when playwright-results.json has unexpected test failures", () => {
    fs.writeFileSync(
      path.join(tempDir, "docs/playwright-results.json"),
      JSON.stringify({
        stats: {
          expected: 8,
          unexpected: 2
        }
      })
    );

    const res = runClaimsCheck({
      cwd: tempDir,
      strictSha: false
    });

    expect(res.passed).toBe(false);
    expect(res.errors.some((e) => e.includes("2 failing tests"))).toBe(true);
  });

  it("fails closed when receipt claims live_execution_verified without API key", () => {
    const oldApiKey = process.env.YOUCAM_API_KEY;
    delete process.env.YOUCAM_API_KEY;

    fs.writeFileSync(
      path.join(tempDir, "docs/live-youcam-receipt.json"),
      JSON.stringify({
        evaluated_commit_sha: "test_sha_clean",
        provider_mode: "LIVE_YOUCAM",
        live_execution_verified: true
      })
    );

    const res = runClaimsCheck({
      cwd: tempDir,
      strictSha: false
    });

    if (oldApiKey) process.env.YOUCAM_API_KEY = oldApiKey;

    expect(res.passed).toBe(false);
    expect(res.errors.some((e) => e.includes("YOUCAM_API_KEY is absent"))).toBe(true);
  });

  it("ensures evidence_authority is added and succeeds with historical SHA snapshot in strictSha mode", () => {
    fs.writeFileSync(
      path.join(tempDir, "docs/live-youcam-receipt.json"),
      JSON.stringify({
        evaluated_commit_sha: "historical_commit_sha_12345",
        provider_mode: "DEMO_FIXTURE",
        live_execution_verified: false
      })
    );

    const res = runClaimsCheck({
      cwd: tempDir,
      strictSha: true
    });

    expect(res.passed).toBe(true);
    const updated = JSON.parse(fs.readFileSync(path.join(tempDir, "docs/live-youcam-receipt.json"), "utf-8"));
    expect(updated.evidence_authority).toBe("LOCAL_DOCUMENTATION_SNAPSHOT");
    expect(fs.existsSync(path.join(tempDir, "docs/ci-evidence-snapshot.json"))).toBe(true);
  });

  it("fails closed when evidence-index.json claims test files that did not exist in the evaluated commit", () => {
    fs.writeFileSync(
      path.join(tempDir, "docs/evidence-index.json"),
      JSON.stringify({
        project: "WearerKey",
        evaluated_commit_sha: "8b71221b7b59692dd60dd0075df82315483d7e75",
        evidence: {
          test_suites: {
            vitest_unit_and_integration: {
              total: 80,
              passed: 80,
              files: ["tests/unit/non-existent-fabricated-test.ts"]
            },
            playwright_browser_e2e: { total: 10, passed: 10 }
          }
        }
      })
    );

    const res = runClaimsCheck({
      cwd: tempDir,
      strictSha: false
    });

    expect(res.passed).toBe(false);
    expect(res.errors.some((e) => e.includes("Evidence integrity violation"))).toBe(true);
    expect(res.errors.some((e) => e.includes("non-existent-fabricated-test.ts"))).toBe(true);
  });
});

