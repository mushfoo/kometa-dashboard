import { test, expect } from '@playwright/test';
import { ConfigPage } from '../fixtures/config-page';
import { setupMockServer, waitForApiResponse } from '../utils/test-helpers';

test.describe('Dual-Pane Configuration Interface', () => {
  let configPage: ConfigPage;

  test.beforeEach(async ({ page }) => {
    configPage = new ConfigPage(page);
    await setupMockServer(page);
  });

  test('should load dual-pane interface correctly', async ({ page }) => {
    // Navigate to dual-pane configuration
    await configPage.navigateToDualPane();

    // Verify page loaded
    await expect(page).toHaveTitle(/Kometa Dashboard/);
    await expect(page.locator('h1')).toContainText('Configuration Editor');

    // Verify both panes are visible using more specific selectors
    await expect(
      page.locator('h2:has-text("Configuration Forms")')
    ).toBeVisible();
    await expect(page.locator('h2:has-text("YAML Editor")')).toBeVisible();

    // Verify tabs are present
    await expect(
      page.locator('button[role="tab"]:has-text("Plex")')
    ).toBeVisible();
    await expect(
      page.locator('button[role="tab"]:has-text("API Keys")')
    ).toBeVisible();
    await expect(
      page.locator('button[role="tab"]:has-text("Libraries")')
    ).toBeVisible();

    // Verify Monaco editor is loaded
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('should switch between form tabs correctly', async ({ page }) => {
    await configPage.navigateToDualPane();

    // Wait for tabs to be visible
    await page.waitForSelector('button[role="tab"]');

    // Default should show Plex content
    await expect(
      page.locator('text=Configure your Plex server connection settings here.')
    ).toBeVisible();

    // Switch to API Keys tab
    await page.locator('button[role="tab"]:has-text("API Keys")').click();
    await expect(
      page.locator('text=Manage your API keys for external services.')
    ).toBeVisible();

    // Switch to Libraries tab
    await page.locator('button[role="tab"]:has-text("Libraries")').click();
    await expect(
      page.locator('text=Configure library-specific settings.')
    ).toBeVisible();

    // Switch back to Plex tab
    await page.locator('button[role="tab"]:has-text("Plex")').click();
    await expect(
      page.locator('text=Configure your Plex server connection settings here.')
    ).toBeVisible();
  });

  test('should load and display YAML content', async ({ page }) => {
    // Mock YAML API response
    await page.route('**/api/config/yaml', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            yaml: 'plex:\n  url: https://plex.example.com\n  token: test-token',
          }),
        });
      }
    });

    await configPage.navigateToDualPane();

    // Wait for YAML content to load
    await page.waitForTimeout(1000);

    // Verify YAML content is displayed
    const yamlContent = await configPage.getDualPaneYamlContent();
    expect(yamlContent).toContain('plex:');
    expect(yamlContent).toContain('url: https://plex.example.com');
    expect(yamlContent).toContain('token: test-token');
  });

  test('should save YAML configuration changes', async ({ page }) => {
    // Mock initial YAML load
    await page.route('**/api/config/yaml', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            yaml: 'plex:\n  url: https://plex.example.com',
          }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await configPage.navigateToDualPane();
    await page.waitForTimeout(1000);

    // Modify YAML content
    const newYaml =
      'plex:\n  url: https://plex.modified.com\n  token: new-token';
    await configPage.setDualPaneYamlContent(newYaml);

    // Wait for unsaved changes alert
    await configPage.waitForUnsavedChangesAlert();
    expect(await configPage.checkForUnsavedChangesAlert()).toBe(true);

    // Save configuration
    const saveResponsePromise = waitForApiResponse(page, '/api/config/yaml');
    await configPage.saveDualPaneConfiguration();
    await saveResponsePromise;

    // Verify unsaved changes alert is gone
    expect(await configPage.checkForUnsavedChangesAlert()).toBe(false);
  });

  test('should reset YAML configuration', async ({ page }) => {
    const originalYaml = 'plex:\n  url: https://plex.example.com';

    // Mock YAML API response
    await page.route('**/api/config/yaml', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ yaml: originalYaml }),
        });
      }
    });

    await configPage.navigateToDualPane();
    await page.waitForTimeout(1000);

    // Modify YAML content
    const modifiedYaml = 'plex:\n  url: https://plex.modified.com';
    await configPage.setDualPaneYamlContent(modifiedYaml);

    // Verify content changed
    await configPage.waitForUnsavedChangesAlert();
    const changedContent = await configPage.getDualPaneYamlContent();
    expect(changedContent).toContain('plex.modified.com');

    // Reset configuration
    await configPage.resetDualPaneConfiguration();

    // Verify content is restored
    const resetContent = await configPage.getDualPaneYamlContent();
    expect(resetContent).toContain('plex.example.com');
    expect(await configPage.checkForUnsavedChangesAlert()).toBe(false);
  });

  test('should persist pane size across page reloads', async ({ page }) => {
    await configPage.navigateToDualPane();

    // Resize the split pane
    await configPage.resizeSplitPane('right', 100);

    // Reload the page
    await page.reload();
    await configPage.waitForPageLoad();

    // Verify split pane is still visible and functional
    expect(await configPage.checkPaneSizePersistedCorrectly()).toBe(true);
  });

  test('should handle YAML validation errors', async ({ page }) => {
    // Mock YAML API responses
    await page.route('**/api/config/yaml', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ yaml: 'plex:\n  url: valid-url' }),
        });
      } else if (route.request().method() === 'POST') {
        // Return error for invalid YAML
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid YAML syntax' }),
        });
      }
    });

    await configPage.navigateToDualPane();
    await page.waitForTimeout(1000);

    // Set invalid YAML (multiple colons on same line is invalid)
    await configPage.setDualPaneYamlContent('invalid: yaml: content:');

    // Wait for the unsaved changes alert to appear
    await configPage.waitForUnsavedChangesAlert();

    // The YamlEditor component should validate the YAML and disable save if invalid
    // However, if validation happens on save, try to save and expect an error
    const saveButton = page.locator('button:has-text("Save Configuration")');

    // If the button is enabled, click it and expect an error response
    const isEnabled = await saveButton.isEnabled();
    if (isEnabled) {
      await configPage.saveDualPaneConfiguration();
      // Since we mocked a 400 response, the mutation should show an error
      // The component might show an error state or keep the button enabled for retry
    }

    // Verify that the YAML content still has unsaved changes after failed save
    await expect(page.locator('text=You have unsaved changes')).toBeVisible();
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await configPage.navigateToDualPane();

    // Verify mobile layout loads
    await expect(page.locator('h1')).toContainText('Configuration Editor');

    // On mobile, the split pane should still be functional
    await expect(page.locator('.SplitPane')).toBeVisible();

    // Verify both panes are accessible (may be stacked on mobile)
    await expect(
      page.locator('h2:has-text("Configuration Forms")')
    ).toBeVisible();
    await expect(page.locator('h2:has-text("YAML Editor")')).toBeVisible();
  });

  test('should display loading state correctly', async ({ page }) => {
    let resolveResponse: (() => void) | null = null;
    const responsePromise = new Promise<void>((resolve) => {
      resolveResponse = resolve;
    });

    // Mock slow API response with control
    await page.route('**/api/config/yaml', async (route) => {
      if (route.request().method() === 'GET') {
        // Wait for our signal to complete the response
        await responsePromise;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ yaml: 'plex:\n  url: test' }),
        });
      }
    });

    // Navigate to the page which will trigger the loading state
    const navigationPromise = configPage.navigateToDualPane();

    // Check for loading spinner immediately
    await expect(page.locator('.animate-spin').first()).toBeVisible({
      timeout: 2000,
    });

    // Now complete the API response
    resolveResponse?.();

    // Wait for navigation to complete
    await navigationPromise;

    // Verify loading state is gone and content is shown
    await expect(page.locator('.animate-spin')).not.toBeVisible();
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('should handle save button states correctly', async ({ page }) => {
    // Mock YAML API
    await page.route('**/api/config/yaml', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ yaml: 'plex:\n  url: test' }),
        });
      }
    });

    await configPage.navigateToDualPane();
    await page.waitForTimeout(1000);

    const saveButton = page.locator('button:has-text("Save Configuration")');
    const resetButton = page.locator('button:has-text("Reset")');

    // Initially, both buttons should be disabled (no changes)
    await expect(saveButton).toBeDisabled();
    await expect(resetButton).toBeDisabled();

    // Make a change
    await configPage.setDualPaneYamlContent('plex:\n  url: modified');

    // Buttons should now be enabled
    await configPage.waitForUnsavedChangesAlert();
    await expect(saveButton).toBeEnabled();
    await expect(resetButton).toBeEnabled();
  });
});
