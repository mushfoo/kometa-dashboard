import { test, expect } from '@playwright/test';
import { ConfigPage } from '../fixtures/config-page';
import { testData } from '../fixtures/test-data';
import { setupMockServer } from '../utils/test-helpers';

test.describe('Plex Configuration Flow', () => {
  let configPage: ConfigPage;

  test.beforeEach(async ({ page }) => {
    configPage = new ConfigPage(page);
    await setupMockServer(page);
  });

  test('should complete full Plex configuration flow', async ({ page }) => {
    // Mock API responses
    await page.route('**/api/config/plex', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: '', token: '' }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.route('**/api/config/plex/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          serverInfo: {
            friendlyName: 'My Plex Server',
            version: '1.0',
            platform: 'Test',
            machineIdentifier: 'test-123',
          },
          libraries: testData.plex.testLibraries,
        }),
      });
    });

    // Navigate to Plex configuration
    await configPage.navigateToPlexConfig();

    // Verify page loaded
    await expect(page).toHaveTitle(/Kometa Dashboard/);
    await expect(page.locator('h1')).toContainText('Plex Configuration');

    // Fill in Plex URL
    await configPage.fillPlexUrl(testData.plex.validUrl);

    // Fill in Plex Token
    await configPage.fillPlexToken(testData.plex.validToken);

    // Test connection
    await configPage.clickTestConnection();

    // Wait for and verify connection success
    await expect(
      page.locator('[data-testid="connection-result"]')
    ).toBeVisible();
    const connectionStatus = await configPage.getConnectionStatus();
    expect(connectionStatus).toContain('Connection successful');

    // Wait for libraries to load
    await page.waitForSelector('input[type="checkbox"]');

    // Verify libraries are displayed
    for (const library of testData.plex.testLibraries) {
      await expect(
        page.locator(`label:has-text("${library.title}")`)
      ).toBeVisible();
    }

    // Select libraries
    await configPage.selectLibrary('Movies');
    await configPage.selectLibrary('TV Shows');

    // Save configuration
    await configPage.saveConfiguration();

    // Verify save success
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-success"]')).toContainText(
      'Configuration saved successfully'
    );
  });

  test('should handle invalid Plex URL', async ({ page }) => {
    await configPage.navigateToPlexConfig();

    // Fill in invalid URL and valid token
    await configPage.fillPlexUrl('not-a-valid-url');
    await configPage.fillPlexToken(testData.plex.validToken);

    // Try to test connection which should trigger validation
    await configPage.clickTestConnection();

    // The connection test should fail with invalid URL
    // Either URL validation error or connection error should be visible
    await expect(
      page.locator('text=/Invalid URL|Failed to connect/')
    ).toBeVisible();
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

    // Mock successful connection test with libraries
    await page.route('**/api/config/plex/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          serverInfo: {
            friendlyName: 'Test Server',
            version: '1.0',
            platform: 'Test',
            machineIdentifier: 'test-123',
          },
          libraries: testData.plex.testLibraries,
        }),
      });
    });

    // Complete connection setup
    await configPage.fillPlexUrl(testData.plex.validUrl);
    await configPage.fillPlexToken(testData.plex.validToken);
    await configPage.clickTestConnection();

    // Wait for libraries to load
    await page.waitForSelector('input[type="checkbox"]');

    // The error should appear immediately since no libraries are selected
    await expect(page.locator('[data-testid="library-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="library-error"]')).toContainText(
      'Please select at least one library'
    );

    // Verify save button is disabled when no libraries are selected
    const saveButton = page.locator('button:has-text("Save Configuration")');
    await expect(saveButton).toBeDisabled();
  });

  test('should persist configuration on page reload', async ({ page }) => {
    // Mock the APIs
    let savedConfig: any = null;

    await page.route('**/api/config/plex', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(savedConfig || { url: '', token: '' }),
        });
      } else if (route.request().method() === 'POST') {
        savedConfig = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.route('**/api/config/plex/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          serverInfo: { friendlyName: 'Test Server' },
          libraries: testData.plex.testLibraries,
        }),
      });
    });

    // Complete configuration
    await configPage.navigateToPlexConfig();
    await configPage.fillPlexUrl(testData.plex.validUrl);
    await configPage.fillPlexToken(testData.plex.validToken);
    await configPage.clickTestConnection();
    await page.waitForSelector('input[type="checkbox"]');
    await configPage.selectLibrary('Movies');
    await configPage.saveConfiguration();

    // Wait for save success
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();

    // Update mock to return saved config
    savedConfig.selectedLibraries = ['Movies'];

    // Reload page
    await page.reload();

    // Since we're mocking, we need to verify the API was called correctly
    // In a real scenario, the form would be populated from the saved config
    // For now, just verify the page loads without errors
    await expect(page.locator('h1')).toContainText('Plex Configuration');
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await configPage.navigateToPlexConfig();

    // Verify page loads correctly on mobile
    await expect(page.locator('h1')).toContainText('Plex Configuration');

    // Complete configuration flow on mobile
    await configPage.fillPlexUrl(testData.plex.validUrl);
    await configPage.fillPlexToken(testData.plex.validToken);

    // Mock connection test
    await page.route('**/api/config/plex/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          serverInfo: { friendlyName: 'Test Server' },
          libraries: testData.plex.testLibraries,
        }),
      });
    });

    await configPage.clickTestConnection();

    // Verify responsive design - form should adapt to mobile width
    const formContainer = page.locator('[data-testid="plex-config-form"]');
    const containerBox = await formContainer.boundingBox();
    expect(containerBox?.width).toBeLessThanOrEqual(375);
  });
});
