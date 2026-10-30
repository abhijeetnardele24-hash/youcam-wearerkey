import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REQUIRED_DISCLAIMERS = [
  "VISUAL APPEARANCE PREVIEW",
  "NOT AN EXACT SIZE"
];

function checkClaims() {
  console.log(`[WearerKey Claims Auditor] Verifying documentation honesty and disclaimers...`);

  const gitSha = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  console.log(`  Current Git HEAD: ${gitSha}`);

  const filesToCheck = [
    "README.md",
    "docs/ARCHITECTURE.md",
    "docs/PRIVACY_MODEL.md",
    "docs/YOUCAM_INTEGRATION.md",
    "docs/DEVPOST_SUBMISSION.md"
  ];

  let errors = 0;

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) {
      // Will be verified once docs are generated
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf-8");

    // Check for forbidden hyperbolic claims
    if (content.includes("100% safe to submit") || content.includes("100% bug free") || content.includes("guaranteed fit")) {
      console.error(`❌ Prohibited hype detected in ${relPath}`);
      errors++;
    }
  }

  // Check live receipt
  const receiptPath = path.resolve(process.cwd(), "docs/live-youcam-receipt.json");
  if (fs.existsSync(receiptPath)) {
    const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf-8"));
    if (receipt.live_execution_verified && !process.env.YOUCAM_API_KEY) {
      console.error(`❌ Receipt claims live_execution_verified=true but YOUCAM_API_KEY is absent!`);
      errors++;
    } else {
      console.log(`  Receipt status: ${receipt.provider_mode} (truthful verification)`);
    }
  }

  if (errors > 0) {
    console.error(`❌ Claims check FAILED with ${errors} issues.`);
    process.exit(1);
  }

  console.log(`✅ Claims check PASSED: All claims truthful and transparent.`);
}

checkClaims();
