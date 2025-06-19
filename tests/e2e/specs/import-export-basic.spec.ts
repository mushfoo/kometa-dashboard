import { test, expect } from '@playwright/test';
import { ConfigPage } from '../fixtures/config-page';
import { setupMockServer } from '../utils/test-helpers';
import fs from 'fs/promises';
import path from 'path';

test.describe('Import/Export Configuration - Basic Functionality', () => {
  let configPage: ConfigPage;

  test.beforeEach(async ({ page }) => {
    configPage = new ConfigPage(page);
    await setupMockServer(page);
  });

  test('should load import/export page successfully', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Verify page loaded correctly
    await expect(page).toHaveTitle(/Kometa Dashboard/);
    await expect(page.locator('h1')).toContainText(
      'Configuration Import/Export'
    );

    // Verify tabs are present
    await expect(
      page.getByRole('tab', { name: 'Export Configuration' })
    ).toBeVisible();
    await expect(
      page.getByRole('tab', { name: 'Import Configuration' })
    ).toBeVisible();

    // Verify export form elements
    await expect(page.locator('input#filename')).toBeVisible();
    await expect(page.locator('select#format')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Export Configuration' })
    ).toBeVisible();
  });

  test('should handle export configuration interaction', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Mock the export API response
    await page.route('**/api/config/export', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            plex: { url: 'http://localhost:32400', token: 'test-token' },
            libraries: { Movies: { operations: ['update'] } },
          }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'text/yaml',
          headers: {
            'Content-Disposition': 'attachment; filename="test-config.yml"',
          },
          body: 'plex:\n  url: http://localhost:32400\n  token: test-token\nlibraries:\n  Movies:\n    operations:\n      - update',
        });
      }
    });

    // Test export options
    await page.fill('input#filename', 'test-export');
    await page.selectOption('select#format', 'yaml');

    // Test checkboxes
    await page.check('input#includeSettings');
    await expect(page.locator('input#includeSettings')).toBeChecked();

    // Click export button (won't actually download in test, but tests the UI)
    await page.getByRole('button', { name: 'Export Configuration' }).click();

    // Verify the request was made (API mocking will handle it)
    await page.waitForTimeout(1000); // Give time for any async operations
  });

  test('should handle import file selection', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Switch to import tab
    await page.click('button:has-text("Import Configuration")');

    // Verify import elements are visible
    await expect(page.locator('input[type="file"]')).toBeVisible();
    await expect(
      page.locator('button:has-text("Analyze Import")')
    ).toBeVisible();

    // Create a test YAML file
    const testConfig = `plex:
  url: http://localhost:32400
  token: test-token-123
libraries:
  Movies:
    operations:
      - update
tmdb:
  apikey: test-api-key`;

    const tempDir = await fs.mkdtemp(path.join(process.cwd(), 'temp-'));
    const testFilePath = path.join(tempDir, 'test-config.yml');
    await fs.writeFile(testFilePath, testConfig);

    try {
      // Mock the import API response
      await page.route('**/api/config/import', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Configuration is valid and ready to import',
            preview: {
              plex: {
                url: 'http://localhost:32400',
                token: '***configured***',
              },
              libraries: ['Movies'],
              tmdb: 'Configured',
              trakt: 'Not configured',
              settings: 'Not included',
            },
            importId: 'test-import-123',
          }),
        });
      });

      // Upload file
      await page.setInputFiles('input[type="file"]', testFilePath);

      // Verify file selection is shown
      await expect(page.locator('[data-testid="file-name"]')).toContainText(
        'test-config.yml'
      );

      // Click analyze button
      await page.click('button:has-text("Analyze Import")');

      // Wait for and verify success message
      await expect(page.locator('[data-testid="import-success"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(
        page.locator('[data-testid="import-success"]')
      ).toContainText('Configuration is valid');

      // Verify preview is shown
      await expect(
        page.locator('[data-testid="import-preview"]')
      ).toBeVisible();
    } finally {
      // Cleanup
      await fs.unlink(testFilePath);
      await fs.rmdir(tempDir);
    }
  });

  test('should handle import validation errors', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Switch to import tab
    await page.click('button:has-text("Import Configuration")');

    // Create an invalid YAML file
    const invalidConfig = `invalid yaml content
  missing: colon
    - broken structure`;

    const tempDir = await fs.mkdtemp(path.join(process.cwd(), 'temp-'));
    const testFilePath = path.join(tempDir, 'invalid-config.yml');
    await fs.writeFile(testFilePath, invalidConfig);

    try {
      // Mock the import API response for validation error
      await page.route('**/api/config/import', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Configuration validation failed with 1 error(s)',
            errors: ['Failed to parse file content: Invalid YAML syntax'],
          }),
        });
      });

      // Upload invalid file
      await page.setInputFiles('input[type="file"]', testFilePath);

      // Click analyze button
      await page.click('button:has-text("Analyze Import")');

      // Wait for and verify error message
      await expect(page.locator('[data-testid="import-error"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.locator('[data-testid="import-error"]')).toContainText(
        'validation failed'
      );

      // Verify confirm button is not available
      await expect(
        page.locator('button:has-text("Confirm Import")')
      ).not.toBeVisible();
    } finally {
      // Cleanup
      await fs.unlink(testFilePath);
      await fs.rmdir(tempDir);
    }
  });

  test('should handle import confirmation flow', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Switch to import tab
    await page.click('button:has-text("Import Configuration")');

    // Create a valid test file
    const validConfig = `plex:
  url: http://localhost:32400
  token: test-token
libraries:
  Movies:
    operations:
      - update`;

    const tempDir = await fs.mkdtemp(path.join(process.cwd(), 'temp-'));
    const testFilePath = path.join(tempDir, 'valid-config.yml');
    await fs.writeFile(testFilePath, validConfig);

    try {
      // Mock the import analysis API
      await page.route('**/api/config/import', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Configuration is valid and ready to import',
            preview: {
              plex: {
                url: 'http://localhost:32400',
                token: '***configured***',
              },
              libraries: ['Movies'],
              tmdb: 'Not configured',
              trakt: 'Not configured',
              settings: 'Not included',
            },
            importId: 'test-import-456',
          }),
        });
      });

      // Mock the import confirmation API
      await page.route('**/api/config/import/confirm', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message:
              'Configuration imported successfully! A backup of your previous configuration has been created.',
          }),
        });
      });

      // Upload file and analyze
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.click('button:has-text("Analyze Import")');

      // Wait for preview to appear
      await expect(page.locator('[data-testid="import-preview"]')).toBeVisible({
        timeout: 10000,
      });

      // Verify preview content
      const previewText = await page
        .locator('[data-testid="import-preview"]')
        .textContent();
      expect(previewText).toContain('http://localhost:32400');
      expect(previewText).toContain('Movies');

      // Click confirm import
      await page.click('button:has-text("Confirm Import")');

      // Wait for success message
      await expect(page.locator('[data-testid="import-success"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(
        page.locator('[data-testid="import-success"]')
      ).toContainText('imported successfully');
    } finally {
      // Cleanup
      await fs.unlink(testFilePath);
      await fs.rmdir(tempDir);
    }
  });

  test('should show warning messages for import', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Switch to import tab
    await page.click('button:has-text("Import Configuration")');

    // Create a config with missing token
    const configWithWarnings = `plex:
  url: http://localhost:32400
libraries:
  Movies:
    operations:
      - update`;

    const tempDir = await fs.mkdtemp(path.join(process.cwd(), 'temp-'));
    const testFilePath = path.join(tempDir, 'warning-config.yml');
    await fs.writeFile(testFilePath, configWithWarnings);

    try {
      // Mock the import API response with warnings
      await page.route('**/api/config/import', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Configuration is valid with 1 warning(s)',
            warnings: [
              "Plex token is missing - you'll need to configure it manually",
            ],
            preview: {
              plex: {
                url: 'http://localhost:32400',
                token: 'Not configured',
              },
              libraries: ['Movies'],
              tmdb: 'Not configured',
              trakt: 'Not configured',
              settings: 'Not included',
            },
            importId: 'test-import-789',
          }),
        });
      });

      // Upload file and analyze
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.click('button:has-text("Analyze Import")');

      // Wait for success message (with warnings)
      await expect(page.locator('[data-testid="import-success"]')).toBeVisible({
        timeout: 10000,
      });

      // Verify warning is displayed
      await expect(
        page.locator('[data-testid="import-warning"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="import-warning"]')
      ).toContainText('Plex token is missing');
    } finally {
      // Cleanup
      await fs.unlink(testFilePath);
      await fs.rmdir(tempDir);
    }
  });

  test('should reject invalid file types', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Switch to import tab
    await page.click('button:has-text("Import Configuration")');

    // Create a text file (invalid type)
    const tempDir = await fs.mkdtemp(path.join(process.cwd(), 'temp-'));
    const testFilePath = path.join(tempDir, 'invalid-file.txt');
    await fs.writeFile(testFilePath, 'This is not a YAML or JSON file');

    try {
      // Mock the import API response for invalid file type
      await page.route('**/api/config/import', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid file type. Only YAML and JSON files are supported.',
          }),
        });
      });

      // Upload invalid file
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.click('button:has-text("Analyze Import")');

      // Wait for and verify error message
      await expect(page.locator('[data-testid="import-error"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.locator('[data-testid="import-error"]')).toContainText(
        'Import failed'
      );
    } finally {
      // Cleanup
      await fs.unlink(testFilePath);
      await fs.rmdir(tempDir);
    }
  });
});
