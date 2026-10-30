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
  /postgres:\/\/[^:]+:[^@]+@/, // Database password in connection string (excluding localhost/test)
  /YOUCAM_API_KEY\s*=\s*["'][a-zA-Z0-9]{16,}["']/ // Hardcoded YouCam API Key
];

function runSecurityScan() {
  console.log(`[WearerKey Security Scan] Scanning tracked repository files for secrets...`);

  // Get list of git tracked files
  const filesOutput = execSync("git ls-files", { encoding: "utf-8" });
  const files = filesOutput.split("\n").map((f) => f.trim()).filter(Boolean);

  let violations = 0;

  for (const file of files) {
    if (file === "pnpm-lock.yaml" || file === ".npmrc" || file.endsWith(".png") || file.endsWith(".jpg")) {
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
        console.error(`🚨 POTENTIAL SECRET DETECTED in ${file}: matches ${pattern}`);
        violations++;
      }
    }
  }

  if (violations > 0) {
    console.error(`❌ Security scan FAILED with ${violations} violations.`);
    process.exit(1);
  }

  console.log(`✅ Security scan PASSED: 0 secrets detected across ${files.length} tracked files.`);
}

runSecurityScan();
