import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

async function main() {
  const screenshotsDir = path.resolve("docs/assets/screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4000";
  console.log(`[Screenshot Capture] Capturing views from ${baseUrl}...`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  // 1. Landing Page
  console.log("  1. Capturing Landing Page...");
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(screenshotsDir, "01-landing-page.png") });

  // 2. Create Pass Page
  console.log("  2. Capturing Create Pass Page...");
  await page.goto(`${baseUrl}/create`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(screenshotsDir, "02-consent-pass-creation.png") });

  // 3. Judge Tour Page & Launch Interactive Split-Screen
  console.log("  3. Launching Judge Tour Interactive Split-Screen...");
  await page.goto(`${baseUrl}/judge`, { waitUntil: "networkidle" });
  const launchBtn = page.getByRole("button", { name: /Launch Interactive Split-Screen/i });
  if (await launchBtn.count() > 0) {
    await launchBtn.click();
    await page.waitForSelector('iframe[title="Wearer Room"]', { timeout: 10000 });
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: path.join(screenshotsDir, "03-judge-split-screen.png") });

  // 4. Helper Workspace from Judge split-screen
  console.log("  4. Capturing Helper Privacy Boundary...");
  const helperFrame = page.locator('iframe[title="Helper Room"]');
  if (await helperFrame.count() > 0) {
    await helperFrame.first().screenshot({ path: path.join(screenshotsDir, "04-helper-privacy-boundary.png") });
  }

  // 5. Wearer Private Mirror from Judge split-screen
  console.log("  5. Capturing Wearer Private Mirror...");
  const wearerFrame = page.locator('iframe[title="Wearer Room"]');
  if (await wearerFrame.count() > 0) {
    await wearerFrame.first().screenshot({ path: path.join(screenshotsDir, "05-wearer-private-mirror.png") });
  }

  // 6. Decision Slip & Feedback
  console.log("  6. Capturing Decision Slip...");
  // Switch to Wearer View tab inside judge controls for a focused shot
  const wearerViewTab = page.locator('#tab-wearer');
  if (await wearerViewTab.count() > 0) {
    await wearerViewTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, "06-decision-slip.png") });
  } else {
    await page.screenshot({ path: path.join(screenshotsDir, "06-decision-slip.png") });
  }

  // 7. Audit Deletion Receipt Page
  console.log("  7. Capturing Audit Deletion Receipt...");
  await page.goto(`${baseUrl}/receipt`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(screenshotsDir, "07-deletion-receipt.png") });

  await browser.close();
  console.log(`✅ All screenshots captured to ${screenshotsDir}`);
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
