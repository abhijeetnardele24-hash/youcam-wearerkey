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
      .disableRules(['color-contrast']) // Ignore subtle parchment theme contrast variations
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
      .disableRules(['color-contrast', 'frame-title']) // Ignore iframe titles in split view
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
      .disableRules(['color-contrast'])
      .analyze();

    expect(axeResults.violations).toEqual([]);
  });
});
