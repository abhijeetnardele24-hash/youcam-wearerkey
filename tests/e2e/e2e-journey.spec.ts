import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WearerKey End-to-End User Journeys & Accessibility', () => {
  test('Home Page renders with correct branding, boundary diagram, and passes Axe accessibility check', async ({ page }) => {
    await page.goto('/');

    // Check title and hero
    await expect(page).toHaveTitle(/WearerKey/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText("Shop together without sharing the wearer's photo");

    // Check Skip to Content link is present
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();

    // Check role-separated boundary diagram
    await expect(page.getByText('The WearerKey Role-Separated Shopping Boundary')).toBeVisible();

    // Check Provider Status Pill on desktop viewports
    if ((page.viewportSize()?.width ?? 1280) >= 768) {
      await expect(page.getByText(/Demo Fixture|YouCam Live|Recorded Live/i)).toBeVisible();
    }

    // Run Axe Accessibility Scan
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(axeResults.violations).toEqual([]);
  });

  test('30-Second Judge Tour launches cleanly and renders both Wearer and Helper perspectives', async ({ page }) => {
    await page.goto('/judge');

    // Verify judge tour header
    await expect(page.getByRole('heading', { level: 1 })).toContainText('WearerKey 30-Second Judge Tour');

    // Click launch button
    const launchBtn = page.getByRole('button', { name: /Launch Interactive Split-Screen/i });
    await expect(launchBtn).toBeVisible();
    await launchBtn.click();

    // Verify successful seeding (No 500 Internal Server Error!)
    await expect(page.getByText(/Active Seed: RECORDED_LIVE_RESULT|DEMO_FIXTURE/i)).toBeVisible({ timeout: 15000 });

    // Verify tablist accessibility
    const tablist = page.getByRole('tablist', { name: /Tour inspection view mode/i });
    await expect(tablist).toBeVisible();

    const splitTab = page.getByRole('tab', { name: 'Split View' });
    const wearerTab = page.getByRole('tab', { name: 'Wearer View' });
    const helperTab = page.getByRole('tab', { name: 'Helper View' });

    await expect(splitTab).toHaveAttribute('aria-selected', 'true');
    await expect(wearerTab).toHaveAttribute('aria-selected', 'false');
    await expect(helperTab).toHaveAttribute('aria-selected', 'false');

    // In Split View, verify both Role A and Role B frames exist
    await expect(page.getByText(/Role A: Private Wearer/i)).toBeVisible();
    await expect(page.getByText(/Role B: Helper \/ Stylist/i)).toBeVisible();

    // Verify Seeded Proposal exists inside both role iframes
    const wearerFrame = page.frameLocator('iframe[title="Wearer Room"]');
    await expect(wearerFrame.getByRole('heading', { name: 'Tailored Camel Wool Overcoat' })).toBeVisible({ timeout: 10000 });

    const helperFrame = page.frameLocator('iframe[title="Helper Room"]');
    await expect(helperFrame.getByRole('heading', { name: 'Tailored Camel Wool Overcoat' })).toBeVisible({ timeout: 10000 });

    // Run Axe Accessibility Scan on Judge Tour Page
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(axeResults.violations).toEqual([]);
  });

  test('Create Pass Page renders form controls and permitted categories', async ({ page }) => {
    await page.goto('/create');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Create Your Try-On Pass');
    await expect(page.getByText(/Permitted Garment Categories/i)).toBeVisible();

    // Verify Category selection toggles
    const outerBtn = page.getByRole('button', { name: /Outerwear/i });
    await expect(outerBtn).toBeVisible();

    // Verify sample reference photo button
    const sampleBtn = page.getByRole('button', { name: /Use Sample Silhouette/i });
    await expect(sampleBtn).toBeVisible();

    // Run Axe Scan
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(axeResults.violations).toEqual([]);
  });

  test('Modal dialog dismisses cleanly on Escape key in Wearer Room', async ({ page }) => {
    // 1. Launch Judge Tour to get active seeded session
    await page.goto('/judge');
    const launchBtn = page.getByRole('button', { name: /Launch Interactive Split-Screen/i });
    await launchBtn.click();
    await expect(page.getByText(/Active Seed:/i)).toBeVisible({ timeout: 15000 });

    // 2. Find Wearer Room iframe and ensure seeded content is loaded
    const wearerFrame = page.frameLocator('iframe[title="Wearer Room"]');
    await expect(wearerFrame.getByRole('heading', { name: 'Tailored Camel Wool Overcoat' })).toBeVisible({ timeout: 15000 });

    // 3. Open Revoke Pass modal
    const revokeBtn = wearerFrame.getByRole('button', { name: /Revoke Pass/i });
    await expect(revokeBtn).toBeVisible({ timeout: 15000 });
    await revokeBtn.click();

    // 4. Modal is visible
    await expect(wearerFrame.getByText(/Revoke Try-On Pass\?/i)).toBeVisible();

    // 5. Press Escape to close modal
    await wearerFrame.locator('body').press('Escape');
    await expect(wearerFrame.getByText(/Revoke Try-On Pass\?/i)).not.toBeVisible();
  });

  test('Full multi-step collaboration journey: create pass, helper proposal, try-on, decision, revocation, and receipt', async ({ browser, baseURL: _baseURL }) => {
    // 1. Wearer Context: create pass from scratch
    const wearerContext = await browser.newContext();
    const wearerPage = await wearerContext.newPage();
    await wearerPage.goto('/create');

    await expect(wearerPage.getByRole('heading', { level: 1 })).toContainText('Create Your Try-On Pass');

    // Load sample silhouette
    const sampleBtn = wearerPage.getByRole('button', { name: /Use Sample Silhouette/i });
    await sampleBtn.click();

    // Submit form to create session and open wearer room
    const createBtn = wearerPage.getByRole('button', { name: /Create Pass & Open Wearer Control Room/i });
    await createBtn.click();

    // 2. Wearer Room loads
    await expect(wearerPage.getByRole('heading', { level: 1 })).toContainText('Wearer Control Room', { timeout: 15000 });

    // Generate Helper Link
    const genLinkBtn = wearerPage.getByRole('button', { name: /Generate Helper Link/i });
    await expect(genLinkBtn).toBeVisible();
    await genLinkBtn.click();

    // Read generated single-use helper link
    const helperInput = wearerPage.locator('input[readonly]');
    await expect(helperInput).toBeVisible({ timeout: 10000 });
    const helperUrl = await helperInput.inputValue();
    expect(helperUrl).toContain('#bootstrap=');

    // 3. Helper Context: open helper room via single-use bootstrap link
    const helperContext = await browser.newContext();
    const helperPage = await helperContext.newPage();
    await helperPage.goto(helperUrl);

    // Helper room authenticates and renders workspace
    await expect(helperPage.getByRole('heading', { level: 1 })).toContainText('Helper Shopping Workspace', { timeout: 15000 });

    // Privacy Boundary Assertion: Helper DOM NEVER contains wearer body photo
    const wearerPhotoInHelper = helperPage.locator('img[src*="/api/wearer/session/source"]');
    await expect(wearerPhotoInHelper).not.toBeAttached();

    // 4. Helper submits garment proposal
    const sampleGarmentBtn = helperPage.getByRole('button', { name: /Use Sample Garment/i });
    await sampleGarmentBtn.click();

    // Wait for canvas to load sample garment and populate form
    await expect(helperPage.locator('img[alt="Garment preview"]')).toBeVisible({ timeout: 5000 });

    const proposeBtn = helperPage.getByRole('button', { name: /Propose to Wearer/i });
    await proposeBtn.click();

    // Verify proposal card appears in Helper Workspace
    await expect(helperPage.getByRole('heading', { name: 'Tailored Autumn Wool Overcoat' })).toBeVisible({ timeout: 10000 });

    // 5. Helper requests virtual try-on
    const requestTryOnBtn = helperPage.getByRole('button', { name: /Request Virtual Try-On/i });
    await expect(requestTryOnBtn).toBeVisible();
    await requestTryOnBtn.click();

    // Verify try-on completes
    await expect(helperPage.getByText('succeeded', { exact: false })).toBeVisible({ timeout: 15000 });

    // Privacy Boundary Assertion: Helper STILL never receives or sees try-on mirror result
    const resultInHelper = helperPage.locator('img[src*="/result"]');
    await expect(resultInHelper).not.toBeAttached();

    // 6. In Wearer Room: proposal is visible with private mirror result
    await expect(wearerPage.getByRole('heading', { name: 'Tailored Autumn Wool Overcoat' })).toBeVisible({ timeout: 15000 });

    // Wearer decides: select Approve and submit Send Verdict
    const approveBtn = wearerPage.getByRole('button', { name: /Approve/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    const sendVerdictBtn = wearerPage.getByRole('button', { name: /Send Verdict/i });
    await expect(sendVerdictBtn).toBeVisible();
    await sendVerdictBtn.click();

    // 7. Helper room reflects wearer approval
    await expect(helperPage.getByText('Approved by Wearer')).toBeVisible({ timeout: 10000 });

    // 8. Wearer revokes the pass
    const revokeBtn = wearerPage.getByRole('button', { name: /Revoke Pass/i });
    await expect(revokeBtn).toBeVisible();
    await revokeBtn.click();

    const confirmRevokeBtn = wearerPage.getByRole('button', { name: /Confirm Revoke & Purge/i });
    await expect(confirmRevokeBtn).toBeVisible();
    await confirmRevokeBtn.click();

    // Wearer sees revoked status
    await expect(wearerPage.getByText(/Pass Revoked — Data Purge Initiated/i)).toBeVisible({ timeout: 15000 });

    // Helper room also updates to reflect revocation
    await expect(helperPage.getByText(/Try-On Pass Revoked by Wearer/i)).toBeVisible({ timeout: 15000 });

    // Assert ordinary role cookies return 410 on protected routes after revocation
    const wearerStatusAfterRevoke = await wearerPage.evaluate(async () => {
      const res = await fetch('/api/wearer/session', { method: 'GET' });
      return res.status;
    });
    expect(wearerStatusAfterRevoke).toBe(410);

    const helperStatusAfterRevoke = await helperPage.evaluate(async () => {
      const res = await fetch('/api/helper/session', { method: 'GET' });
      return res.status;
    });
    expect(helperStatusAfterRevoke).toBe(410);

    // Assert confirmed deletion produces no recovery credential cookie in normal flow
    const wearerCookies = await wearerContext.cookies();
    const recoveryCookie = wearerCookies.find((c) => c.name === 'wearerkey_purge_recovery');
    expect(recoveryCookie).toBeUndefined();

    // Assert helper DOM strictly never receives wearer source or result images
    expect(await helperPage.locator('img[src*="/source"]').count()).toBe(0);
    expect(await helperPage.locator('img[src*="/result"]').count()).toBe(0);

    // 9. Run Axe Accessibility Scan on Revoked States for both Wearer and Helper
    const wearerAxe = await new AxeBuilder({ page: wearerPage })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(wearerAxe.violations).toEqual([]);

    const helperAxe = await new AxeBuilder({ page: helperPage })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(helperAxe.violations).toEqual([]);

    await wearerContext.close();
    await helperContext.close();
  });
});
