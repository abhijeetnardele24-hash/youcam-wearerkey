import { execSync } from "node:child_process";

function runStep(name: string, cmd: string) {
  console.log(`\n======================================================`);
  console.log(`▶ Step: ${name}`);
  console.log(`  Running: ${cmd}`);
  console.log(`======================================================\n`);
  try {
    execSync(cmd, { stdio: "inherit" });
    console.log(`\n✔ ${name} PASSED\n`);
  } catch (err: any) {
    console.error(`\n❌ ${name} FAILED\n`);
    process.exit(1);
  }
}

function verifyAll() {
  const start = Date.now();
  console.log(`\n🔍 STARTING MASTER WEARERKEY VERIFICATION SUITE\n`);

  runStep("Vitest Unit & Integration Tests", "pnpm test");
  runStep("Web Frontend Production Build", "pnpm --filter @wearerkey/web build");
  runStep("Security & Secrets Audit", "npx tsx scripts/security-scan.ts");
  runStep("Honesty & Claims Validation", "npx tsx scripts/check-claims.ts");

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`🎉 ALL VERIFICATION CHECKS PASSED IN ${elapsed}s`);
  console.log(`======================================================\n`);
}

verifyAll();
