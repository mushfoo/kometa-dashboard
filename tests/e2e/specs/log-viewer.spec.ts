import { test, expect } from '@playwright/test';
import { BasePage } from '../fixtures/base-page';

test.describe('Log Viewer', () => {
  let basePage: BasePage;

  test.beforeEach(async ({ page }) => {
    basePage = new BasePage(page);
    await basePage.navigate('/logs');
  });

  test('should display log viewer interface', async ({ page }) => {
    // Wait for logs page to load
    await expect(page.locator('h1')).toContainText('Logs');

    // Check for log viewer components
    await expect(page.locator('text=Live Logs')).toBeVisible();
    await expect(
      page.locator('text=Connected').or(page.locator('text=Disconnected'))
    ).toBeVisible();

    // Check for controls
    await expect(page.locator('select')).toBeVisible(); // Level filter
    await expect(page.locator('text=Auto-scroll')).toBeVisible();
  });

  test('should show level filtering options', async ({ page }) => {
    // Check level filter dropdown
    const levelSelect = page.locator('select').first();
    await expect(levelSelect).toBeVisible();

    // Check that all log levels are available
    await levelSelect.click();
    await expect(page.locator('option[value="DEBUG"]')).toBeVisible();
    await expect(page.locator('option[value="INFO"]')).toBeVisible();
    await expect(page.locator('option[value="WARNING"]')).toBeVisible();
    await expect(page.locator('option[value="ERROR"]')).toBeVisible();
  });

  test('should display advanced filters when enabled', async ({ page }) => {
    // Click filters button
    const filtersButton = page.locator('button', { hasText: 'Filters' });
    await filtersButton.click();

    // Check for advanced filter controls
    await expect(page.locator('text=Search Messages')).toBeVisible();
    await expect(
      page.locator('input[placeholder*="Search log messages"]')
    ).toBeVisible();
    await expect(page.locator('text=Regex')).toBeVisible();
    await expect(page.locator('text=Filter by Date')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test('should filter logs by level', async ({ page }) => {
    // Select ERROR level filter
    const levelSelect = page.locator('select').first();
    await levelSelect.selectOption('ERROR');

    // Check that filter is applied in summary
    await expect(page.locator('text=Level: ERROR')).toBeVisible();
  });

  test('should search log messages', async ({ page }) => {
    // Open filters
    await page.locator('button', { hasText: 'Filters' }).click();

    // Enter search term
    const searchInput = page.locator(
      'input[placeholder*="Search log messages"]'
    );
    await searchInput.fill('error');

    // Check that search filter is applied
    await expect(page.locator('text=Search: "error"')).toBeVisible();
  });

  test('should handle regex search', async ({ page }) => {
    // Open filters
    await page.locator('button', { hasText: 'Filters' }).click();

    // Enable regex search
    await page
      .locator('text=Regex')
      .locator('..')
      .locator('input[type="checkbox"]')
      .check();

    // Enter regex pattern
    const searchInput = page.locator(
      'input[placeholder*="Search log messages"]'
    );
    await searchInput.fill('error|warning');

    // Check that regex search is indicated
    await expect(
      page.locator('text=Search: "error|warning" (regex)')
    ).toBeVisible();

    // Check for regex help text
    await expect(
      page.locator('text=Use regular expressions for pattern matching')
    ).toBeVisible();
  });

  test('should filter by date', async ({ page }) => {
    // Open filters
    await page.locator('button', { hasText: 'Filters' }).click();

    // Set date filter
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill('2024-01-01');

    // Check that date filter is applied
    await expect(page.locator('text=Date: 1/1/2024')).toBeVisible();
  });

  test('should display log control buttons', async ({ page }) => {
    // Check for control buttons
    await expect(page.locator('button[title="Scroll to top"]')).toBeVisible();
    await expect(
      page.locator('button[title="Scroll to bottom"]')
    ).toBeVisible();
    await expect(page.locator('button[title="Export logs"]')).toBeVisible();
    await expect(page.locator('button[title="Clear logs"]')).toBeVisible();
  });

  test('should export logs', async ({ page }) => {
    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.locator('button[title="Export logs"]').click();

    // Wait for download
    const download = await downloadPromise;

    // Check download filename
    expect(download.suggestedFilename()).toMatch(
      /kometa-logs-\d{4}-\d{2}-\d{2}\.txt/
    );
  });

  test('should clear logs', async ({ page }) => {
    // Click clear logs button
    await page.locator('button[title="Clear logs"]').click();

    // Should show "No logs to display" message
    await expect(page.locator('text=No logs to display')).toBeVisible();
  });

  test('should handle auto-scroll toggle', async ({ page }) => {
    // Check auto-scroll checkbox
    const autoScrollCheckbox = page
      .locator('text=Auto-scroll')
      .locator('..')
      .locator('input[type="checkbox"]');

    // Should be checked by default
    await expect(autoScrollCheckbox).toBeChecked();

    // Uncheck auto-scroll
    await autoScrollCheckbox.uncheck();
    await expect(autoScrollCheckbox).not.toBeChecked();
  });

  test('should show connection status', async ({ page }) => {
    // Check for connection indicator
    await expect(
      page.locator('text=Connected').or(page.locator('text=Disconnected'))
    ).toBeVisible();

    // Check for WiFi icon
    await expect(
      page
        .locator('[data-testid="wifi-icon"]')
        .or(page.locator('svg').filter({ hasText: 'wifi' }))
    ).toBeVisible();
  });

  test('should handle multiple active filters', async ({ page }) => {
    // Open filters
    await page.locator('button', { hasText: 'Filters' }).click();

    // Apply multiple filters
    await page.locator('select').first().selectOption('ERROR');
    await page
      .locator('input[placeholder*="Search log messages"]')
      .fill('test');
    await page.locator('input[type="date"]').fill('2024-01-01');

    // Check that all filters are shown in summary
    await expect(page.locator('text=Level: ERROR')).toBeVisible();
    await expect(page.locator('text=Search: "test"')).toBeVisible();
    await expect(page.locator('text=Date: 1/1/2024')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that log viewer is still functional
    await expect(page.locator('h1')).toContainText('Logs');
    await expect(page.locator('text=Live Logs')).toBeVisible();

    // Check that controls are accessible
    await expect(page.locator('button', { hasText: 'Filters' })).toBeVisible();
  });

  test('should handle connection errors', async ({ page }) => {
    // Mock SSE connection failure
    await page.route('/api/stream*', (route) => route.abort());

    // Reload page to trigger error
    await page.reload();

    // Should show disconnected state
    await expect(page.locator('text=Disconnected')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('text=Connection error')).toBeVisible({
      timeout: 10000,
    });
  });
});
