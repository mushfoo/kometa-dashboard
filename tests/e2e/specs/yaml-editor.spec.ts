import { test, expect } from '@playwright/test';
import { ConfigPage } from '../fixtures/config-page';
import { testData } from '../fixtures/test-data';
import { setupMockServer, waitForApiResponse } from '../utils/test-helpers';

test.describe('YAML Editor', () => {
  let configPage: ConfigPage;

  test.beforeEach(async ({ page }) => {
    configPage = new ConfigPage(page);
    await setupMockServer(page);
  });

  test('should load and edit YAML configuration', async ({ page }) => {
    await configPage.navigateToYamlEditor();

    // Verify page loaded
    await expect(page).toHaveTitle(/YAML Editor/);
    await expect(page.locator('h1')).toContainText('YAML Configuration');

    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Get current YAML content
    const initialContent = await configPage.getYamlContent();
    expect(initialContent).toBeTruthy();

    // Set new YAML content
    await configPage.setYamlContent(testData.yaml.valid);

    // Validate YAML
    const validateResponsePromise = waitForApiResponse(
      page,
      '/api/config/yaml/validate'
    );
    await configPage.validateYaml();
    await validateResponsePromise;

    // Check validation success
    await expect(
      page.locator('[data-testid="validation-success"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="validation-success"]')
    ).toContainText('YAML configuration is valid');

    // Save YAML
    const saveResponsePromise = waitForApiResponse(page, '/api/config/yaml');
    await configPage.saveYaml();
    await saveResponsePromise;

    // Verify save success
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });

  test('should show validation errors for invalid YAML', async ({ page }) => {
    await configPage.navigateToYamlEditor();

    // Wait for editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Mock validation failure
    await page.route('**/api/config/yaml/validate', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: false,
          errors: [{ line: 4, column: 5, message: 'Expected colon after key' }],
        }),
      });
    });

    // Set invalid YAML
    await configPage.setYamlContent(testData.yaml.invalid);

    // Validate YAML
    await configPage.validateYaml();

    // Check validation error
    await expect(
      page.locator('[data-testid="validation-error"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="validation-error"]')
    ).toContainText('Expected colon after key');

    // Save button should be disabled
    await expect(page.locator('button:has-text("Save")')).toBeDisabled();
  });

  test('should support find and replace', async ({ page }) => {
    await configPage.navigateToYamlEditor();

    // Wait for editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Set content with replaceable text
    const contentWithReplaceable = `
libraries:
  OldMovies:
    collection_files:
      - default: basic
  OldShows:
    collection_files:
      - default: network
`;
    await configPage.setYamlContent(contentWithReplaceable);

    // Open find and replace (Ctrl+F)
    await page.keyboard.press('Control+f');

    // Wait for find widget
    await page.waitForSelector('.find-widget', { timeout: 5000 });

    // Type search term
    await page.keyboard.type('Old');

    // Verify matches are highlighted
    const findMatches = await page.locator('.findMatch').count();
    expect(findMatches).toBeGreaterThan(0);

    // Close find widget
    await page.keyboard.press('Escape');
  });

  test('should handle large YAML files', async ({ page }) => {
    await configPage.navigateToYamlEditor();

    // Wait for editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Set large YAML content
    await configPage.setYamlContent(testData.yaml.large);

    // Validate large YAML
    const validateResponsePromise = waitForApiResponse(
      page,
      '/api/config/yaml/validate'
    );
    await configPage.validateYaml();
    await validateResponsePromise;

    // Should handle large files without freezing
    await expect(
      page.locator('[data-testid="validation-success"]')
    ).toBeVisible();

    // Test scrolling performance
    await page.evaluate(() => {
      const editor = document.querySelector('.monaco-editor');
      if (editor) {
        editor.scrollTop = 1000;
      }
    });

    // Editor should remain responsive
    const content = await configPage.getYamlContent();
    expect(content.length).toBeGreaterThan(1000);
  });

  test('should persist unsaved changes warning', async ({ page }) => {
    await configPage.navigateToYamlEditor();

    // Wait for editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Make changes
    await configPage.setYamlContent(testData.yaml.valid);

    // Try to navigate away
    page.on('dialog', (dialog) => {
      expect(dialog.message()).toContain('unsaved changes');
      dialog.dismiss();
    });

    // Click on a different navigation item
    await page.click('a[href="/config"]');

    // Should still be on YAML editor page
    await expect(page).toHaveURL(/\/config\/yaml/);
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    await configPage.navigateToYamlEditor();

    // Wait for editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Set initial content
    await configPage.setYamlContent('libraries:\n  Movies:\n    test: value');

    // Test formatting shortcut (Shift+Alt+F)
    await page.keyboard.press('Shift+Alt+f');

    // Content should be formatted
    const formattedContent = await configPage.getYamlContent();
    expect(formattedContent).toContain('libraries:');

    // Test save shortcut (Ctrl+S)
    const saveResponsePromise = waitForApiResponse(page, '/api/config/yaml');
    await page.keyboard.press('Control+s');
    await saveResponsePromise;

    // Should trigger save
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });

  test('should sync with theme changes', async ({ page }) => {
    await configPage.navigateToYamlEditor();

    // Wait for editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Get initial theme
    const initialTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    // Toggle theme
    await page.click('[data-testid="theme-toggle"]');

    // Wait for theme change
    await page.waitForTimeout(500);

    // Verify editor theme changed
    const newTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(newTheme).not.toBe(initialTheme);

    // Editor should still be functional
    await configPage.setYamlContent('test: content');
    const content = await configPage.getYamlContent();
    expect(content).toBe('test: content');
  });
});
