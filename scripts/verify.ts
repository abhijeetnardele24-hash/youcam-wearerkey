import { execSync } from "node:child_process";

function runStep(name: string, cmd: string, env: Record<string, string> = {}) {
  console.log(`\n======================================================`);
  console.log(`▶ Step: ${name}`);
  console.log(`  Running: ${cmd}`);
  console.log(`======================================================\n`);
  try {
    execSync(cmd, {
      stdio: "inherit",
      env: { ...process.env, ...env }
    });
    console.log(`\n✔ ${name} PASSED\n`);
  } catch (_err: any) {
    console.error(`\n❌ ${name} FAILED\n`);
    process.exit(1);
  }
}

function verifyAll() {
  const start = Date.now();
  console.log(`\n🔍 STARTING MASTER WEARERKEY VERIFICATION SUITE\n`);

  runStep(
    "Vitest Unit & Integration Tests (Domain, API, YouCam Provider)",
    "npx vitest run --reporter=json --outputFile=docs/vitest-results.json"
  );

  runStep(
    "Full Monorepo Build (Contracts, Domain, API, Web)",
    "pnpm build"
  );

  runStep(
    "Playwright E2E Journeys & Axe Accessibility (Desktop & Mobile)",
    "npx playwright test --reporter=json",
    { PLAYWRIGHT_JSON_OUTPUT_NAME: "docs/playwright-results.json" }
  );

  runStep(
    "Security & Secrets Audit",
    "npx tsx scripts/security-scan.ts"
  );

  runStep(
    "Honesty, Terminology & Claims Validation",
    "npx tsx scripts/check-claims.ts"
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`🎉 ALL VERIFICATION CHECKS PASSED IN ${elapsed}s`);
  console.log(`   Final Verdict: INTERNAL_COMPLETE_EXTERNAL_ACTION_REQUIRED`);
  console.log(`======================================================\n`);
}

verifyAll();
