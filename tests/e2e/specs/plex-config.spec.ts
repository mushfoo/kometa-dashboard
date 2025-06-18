import { test, expect } from '@playwright/test';
import { ConfigPage } from '../fixtures/config-page';
import { testData } from '../fixtures/test-data';
import { setupMockServer, waitForApiResponse } from '../utils/test-helpers';

test.describe('Plex Configuration Flow', () => {
  let configPage: ConfigPage;

  test.beforeEach(async ({ page }) => {
    configPage = new ConfigPage(page);
    await setupMockServer(page);
  });

  test('should complete full Plex configuration flow', async ({ page }) => {
    // Navigate to Plex configuration
    await configPage.navigateToPlexConfig();

    // Verify page loaded
    await expect(page).toHaveTitle(/Plex Configuration/);
    await expect(page.locator('h1')).toContainText('Plex Configuration');

    // Fill in Plex URL
    await configPage.fillPlexUrl(testData.plex.validUrl);

    // Fill in Plex Token
    await configPage.fillPlexToken(testData.plex.validToken);

    // Test connection
    const responsePromise = waitForApiResponse(page, '/api/config/plex/test');
    await configPage.clickTestConnection();
    await responsePromise;

    // Verify connection success
    const connectionStatus = await configPage.getConnectionStatus();
    expect(connectionStatus).toContain('Connection successful');

    // Verify libraries are displayed
    for (const library of testData.plex.testLibraries) {
      await expect(page.locator(`text=${library.title}`)).toBeVisible();
    }

    // Select libraries
    await configPage.selectLibrary('Movies');
    await configPage.selectLibrary('TV Shows');

    // Save configuration
    const saveResponsePromise = waitForApiResponse(page, '/api/config/plex');
    await configPage.saveConfiguration();
    await saveResponsePromise;

    // Verify save success
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-success"]')).toContainText(
      'Configuration saved successfully'
    );
  });

  test('should handle invalid Plex URL', async ({ page }) => {
    await configPage.navigateToPlexConfig();

    // Fill in invalid URL
    await configPage.fillPlexUrl(testData.plex.invalidUrl);
    await configPage.fillPlexToken(testData.plex.validToken);

    // Try to test connection
    await configPage.clickTestConnection();

    // Verify error message
    await expect(page.locator('[data-testid="url-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="url-error"]')).toContainText(
      'Please enter a valid URL'
    );
  });

  test('should handle connection failure', async ({ page }) => {
    await configPage.navigateToPlexConfig();

    // Mock connection failure
    await page.route('**/api/config/plex/test', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to connect to Plex server' }),
      });
    });

    // Fill in valid data
    await configPage.fillPlexUrl(testData.plex.validUrl);
    await configPage.fillPlexToken(testData.plex.validToken);

    // Test connection
    await configPage.clickTestConnection();

    // Verify error message
    const connectionStatus = await configPage.getConnectionStatus();
    expect(connectionStatus).toContain('Failed to connect to Plex server');
  });

  test('should require at least one library selection', async ({ page }) => {
    await configPage.navigateToPlexConfig();

    // Complete connection setup
    await configPage.fillPlexUrl(testData.plex.validUrl);
    await configPage.fillPlexToken(testData.plex.validToken);
    await configPage.clickTestConnection();

    // Wait for libraries to load
    await page.waitForSelector('input[type="checkbox"]');

    // Try to save without selecting any libraries
    await configPage.saveConfiguration();

    // Verify error message
    await expect(page.locator('[data-testid="library-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="library-error"]')).toContainText(
      'Please select at least one library'
    );
  });

  test('should persist configuration on page reload', async ({ page }) => {
    // Complete configuration
    await configPage.navigateToPlexConfig();
    await configPage.fillPlexUrl(testData.plex.validUrl);
    await configPage.fillPlexToken(testData.plex.validToken);
    await configPage.clickTestConnection();
    await page.waitForSelector('input[type="checkbox"]');
    await configPage.selectLibrary('Movies');
    await configPage.saveConfiguration();

    // Reload page
    await page.reload();

    // Verify configuration persists
    const urlInput = await page.locator('input[name="plexUrl"]');
    await expect(urlInput).toHaveValue(testData.plex.validUrl);

    // Token should be masked
    const tokenInput = await page.locator('input[name="plexToken"]');
    const tokenValue = await tokenInput.inputValue();
    expect(tokenValue).toMatch(/\*+/); // Should contain asterisks
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await configPage.navigateToPlexConfig();

    // Verify mobile menu is visible
    await expect(
      page.locator('[data-testid="mobile-menu-button"]')
    ).toBeVisible();

    // Complete configuration flow
    await configPage.fillPlexUrl(testData.plex.validUrl);
    await configPage.fillPlexToken(testData.plex.validToken);
    await configPage.clickTestConnection();

    // Verify responsive design
    const formContainer = page.locator('[data-testid="plex-config-form"]');
    const containerWidth = await formContainer.boundingBox();
    expect(containerWidth?.width).toBeLessThanOrEqual(375);
  });
});
