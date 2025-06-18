import { test, expect } from '@playwright/test';

test.describe('Demo Screenshots for PR', () => {
  test('capture home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(
      'Welcome to Kometa Dashboard'
    );
    await page.screenshot({
      path: 'tests/e2e/screenshots/01-home-page.png',
      fullPage: true,
    });
  });

  test('capture dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
    await page.screenshot({
      path: 'tests/e2e/screenshots/02-dashboard-page.png',
      fullPage: true,
    });
  });

  test('capture config page', async ({ page }) => {
    await page.goto('/config');
    await expect(page.locator('h1')).toContainText('Configuration');
    await page.screenshot({
      path: 'tests/e2e/screenshots/03-config-page.png',
      fullPage: true,
    });
  });

  test('capture config plex page', async ({ page }) => {
    await page.goto('/config/plex');
    await expect(page.locator('h1')).toContainText('Plex Configuration');
    await page.screenshot({
      path: 'tests/e2e/screenshots/04-plex-config.png',
      fullPage: true,
    });
  });

  test('capture config api keys page', async ({ page }) => {
    await page.goto('/config/api-keys');
    await expect(page.locator('h1')).toContainText('API Keys');
    await page.screenshot({
      path: 'tests/e2e/screenshots/05-api-keys.png',
      fullPage: true,
    });
  });

  test('capture yaml editor page', async ({ page }) => {
    await page.goto('/config/yaml');
    await expect(page.locator('h1')).toContainText('YAML Configuration');
    await page.screenshot({
      path: 'tests/e2e/screenshots/06-yaml-editor.png',
      fullPage: true,
    });
  });

  test('capture import export page', async ({ page }) => {
    await page.goto('/config/import-export');
    await expect(page.locator('h1')).toContainText(
      'Configuration Import/Export'
    );
    await page.screenshot({
      path: 'tests/e2e/screenshots/07-import-export.png',
      fullPage: true,
    });
  });

  test('capture mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
    await page.screenshot({
      path: 'tests/e2e/screenshots/08-mobile-dashboard.png',
      fullPage: true,
    });
  });
});
