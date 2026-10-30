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

  runStep("Vitest Unit & Integration Tests (Domain, API, YouCam Provider)", "pnpm test");
  runStep("Full Monorepo Build (Contracts, Domain, API, Web)", "pnpm build");
  runStep("Playwright E2E Journeys & Axe Accessibility (Desktop & Mobile)", "pnpm test:e2e");
  runStep("Security & Secrets Audit", "npx tsx scripts/security-scan.ts");
  runStep("Honesty, Terminology & Claims Validation", "npx tsx scripts/check-claims.ts");

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`🎉 ALL VERIFICATION CHECKS PASSED IN ${elapsed}s`);
  console.log(`======================================================\n`);
}

verifyAll();
