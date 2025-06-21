import { test, expect } from '@playwright/test';
import { BasePage } from '../fixtures/base-page';

test.describe('Dashboard', () => {
  let basePage: BasePage;

  test.beforeEach(async ({ page }) => {
    basePage = new BasePage(page);
    await basePage.navigate('/dashboard');
  });

  test('should display system status cards', async ({ page }) => {
    // Wait for dashboard to load
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Check for system status cards
    await expect(page.locator('text=System Status')).toBeVisible();
    await expect(page.locator('text=Uptime')).toBeVisible();
    await expect(page.locator('text=Memory Usage')).toBeVisible();
    await expect(page.locator('text=Storage')).toBeVisible();

    // Check that status values are displayed
    await expect(
      page.locator('[data-testid="status-card"]').first()
    ).toBeVisible();
  });

  test('should display operation status section', async ({ page }) => {
    // Check for operation status card
    await expect(page.locator('text=Current Operation')).toBeVisible();

    // Check for start/stop buttons
    await expect(
      page.locator('button', { hasText: 'Start Operation' })
    ).toBeVisible();
    await expect(
      page.locator('button', { hasText: 'Stop Operation' })
    ).toBeVisible();

    // Check connection indicator
    await expect(
      page.locator('text=Connected').or(page.locator('text=Disconnected'))
    ).toBeVisible();
  });

  test('should display quick actions panel', async ({ page }) => {
    // Check for quick actions section
    await expect(page.locator('text=Quick Actions')).toBeVisible();

    // Check for action buttons
    await expect(page.locator('button', { hasText: 'Run Now' })).toBeVisible();
    await expect(
      page.locator('button', { hasText: 'Clear Cache' })
    ).toBeVisible();
    await expect(
      page.locator('button', { hasText: 'Reload Config' })
    ).toBeVisible();
  });

  test('should display recent operations', async ({ page }) => {
    // Check for recent operations section
    await expect(page.locator('text=Recent Operations')).toBeVisible();

    // Should show either operations or "No recent operations found"
    await expect(
      page
        .locator('text=No recent operations found')
        .or(page.locator('[data-testid="operation-item"]').first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle quick actions', async ({ page }) => {
    // Test Clear Cache action
    const clearCacheButton = page.locator('button', { hasText: 'Clear Cache' });
    await clearCacheButton.click();

    // Should show processing state
    await expect(page.locator('text=Processing...')).toBeVisible();

    // Wait for completion and check for success message
    await expect(page.locator('text=Cache cleared successfully')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should handle reload config action', async ({ page }) => {
    // Test Reload Config action
    const reloadButton = page.locator('button', { hasText: 'Reload Config' });
    await reloadButton.click();

    // Should show processing state
    await expect(page.locator('text=Processing...')).toBeVisible();

    // Wait for completion (may succeed or fail depending on config state)
    await expect(
      page
        .locator('text=Configuration reloaded and validated')
        .or(page.locator('text=Failed to validate configuration'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('should show real-time status updates', async ({ page }) => {
    // Check for status timestamp
    await expect(page.locator('text=Last updated:')).toBeVisible();

    // Check for connection status indicator
    const statusIcon = page
      .locator('[class*="bg-green-500"], [class*="bg-red-500"]')
      .first();
    await expect(statusIcon).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that dashboard is still functional
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('text=System Status')).toBeVisible();
    await expect(page.locator('text=Current Operation')).toBeVisible();
    await expect(page.locator('text=Quick Actions')).toBeVisible();
  });

  test('should handle connection errors gracefully', async ({ page }) => {
    // Mock network failure for status endpoint
    await page.route('/api/status', (route) => route.abort());

    // Reload page to trigger error
    await page.reload();

    // Should show error state
    await expect(page.locator('text=Failed to load dashboard')).toBeVisible({
      timeout: 10000,
    });
  });
});
