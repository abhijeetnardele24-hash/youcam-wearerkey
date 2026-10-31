import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Patterns that might indicate leaked secrets
const FORBIDDEN_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/, // Google API Key
  /sk-[a-zA-Z0-9]{32,}/, // OpenAI API Key
  /ghp_[a-zA-Z0-9]{36}/, // GitHub Personal Access Token
  /gho_[a-zA-Z0-9]{36}/, // GitHub OAuth Access Token
  /glpat-[0-9a-zA-Z-_]{20}/, // GitLab Personal Access Token
  /-----BEGIN PRIVATE KEY-----/,
  /-----BEGIN RSA PRIVATE KEY-----/,
  /postgres:\/\/[^:]+:[^@]+@(?!localhost)/, // Database password in connection string (excluding localhost/test)
  /YOUCAM_API_KEY\s*=\s*["'][a-zA-Z0-9]{16,}["']/ // Hardcoded YouCam API Key
];

function runSecurityScan() {
  console.log(`[WearerKey Security Scan] Scanning tracked repository files for secrets...`);

  // 1. Scan git tracked files in working tree
  const filesOutput = execSync("git ls-files", { encoding: "utf-8" });
  const files = filesOutput.split("\n").map((f) => f.trim()).filter(Boolean);

  let violations = 0;

  for (const file of files) {
    if (
      file === "pnpm-lock.yaml" ||
      file === ".npmrc" ||
      file === "scripts/security-scan.ts" ||
      file.endsWith(".png") ||
      file.endsWith(".jpg")
    ) {
      continue;
    }

    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf-8");

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        // Exception: allow .env.example with dummy values
        if (file === ".env.example" && content.includes("your-youcam-api-key-here")) {
          continue;
        }
        if (content.includes("postgres://user:password@localhost")) {
          continue;
        }
        console.error(`🚨 POTENTIAL SECRET DETECTED in ${file}: matches ${pattern}`);
        violations++;
      }
    }
  }

  // 2. Scan Git commit history diffs for secrets
  console.log(`[WearerKey Security Scan] Scanning entire Git commit history for secret leakage...`);
  try {
    const gitLogOutput = execSync("git log -p -U0", { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
    const logLines = gitLogOutput.split("\n");

    let currentFile = "";
    for (const line of logLines) {
      if (line.startsWith("diff --git")) {
        const parts = line.split(" ");
        currentFile = parts[2] ? parts[2].replace(/^a\//, "") : "";
        continue;
      }

      // Skip the scanner itself
      if (currentFile.includes("security-scan.ts") || currentFile.includes("security-scan.js")) {
        continue;
      }

      // Only examine added lines in commit diffs
      if (!line.startsWith("+") || line.startsWith("+++")) continue;
      const addedContent = line.slice(1);

      if (addedContent.includes("your-youcam-api-key-here")) continue;
      if (addedContent.includes("postgres://user:password@localhost")) continue;

      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(addedContent)) {
          console.error(`🚨 POTENTIAL SECRET DETECTED in Git history (${currentFile}): matches ${pattern}`);
          violations++;
        }
      }
    }
  } catch (err: any) {
    console.warn(`[WearerKey Security Scan] Git history scan warning: ${err.message}`);
  }

  if (violations > 0) {
    console.error(`❌ Security scan FAILED with ${violations} violations.`);
    process.exit(1);
  }

  console.log(`✅ Security scan PASSED: 0 secrets detected across ${files.length} tracked files and complete Git history.`);
}

runSecurityScan();
