import { test, expect } from '@playwright/test';
import { ConfigPage } from '../fixtures/config-page';
import { testData } from '../fixtures/test-data';
import {
  setupMockServer,
  waitForApiResponse,
  createTempFile,
  cleanupTempFiles,
  generateValidYamlConfig,
} from '../utils/test-helpers';
import fs from 'fs/promises';

test.describe('Import/Export Configuration', () => {
  let configPage: ConfigPage;

  test.beforeEach(async ({ page }) => {
    configPage = new ConfigPage(page);
    await setupMockServer(page);
  });

  test.afterEach(async () => {
    await cleanupTempFiles();
  });

  test('should export current configuration', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Verify page loaded
    await expect(page).toHaveTitle(/Import\/Export/);
    await expect(page.locator('h1')).toContainText(
      'Import/Export Configuration'
    );

    // Mock export API response
    const exportConfig = generateValidYamlConfig();
    await page.route('**/api/config/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/yaml',
        headers: {
          'Content-Disposition':
            'attachment; filename="kometa-config-2024-01-01.yml"',
        },
        body: exportConfig,
      });
    });

    // Set up download promise
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await configPage.clickExport();

    // Wait for download
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(
      /kometa-config-\d{4}-\d{2}-\d{2}\.yml/
    );

    // Save and verify content
    const downloadPath = await download.path();
    if (downloadPath) {
      const content = await fs.readFile(downloadPath, 'utf-8');
      expect(content).toBe(exportConfig);
    }
  });

  test('should import configuration file', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Create test import file
    const importConfig = generateValidYamlConfig();
    const importFilePath = await createTempFile(
      importConfig,
      'test-import.yml'
    );

    // Mock import API response
    await page.route('**/api/config/import', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          preview: {
            libraries: ['Movies', 'TV Shows'],
            plexUrl: 'http://localhost:32400',
            hasApiKeys: true,
            settingsCount: 15,
          },
          valid: true,
        }),
      });
    });

    // Upload file
    await configPage.uploadImportFile(importFilePath);

    // Wait for preview
    await page.waitForSelector('[data-testid="import-preview"]', {
      timeout: 10000,
    });

    // Verify preview content
    const previewText = await configPage.getImportPreview();
    expect(previewText).toContain('Movies');
    expect(previewText).toContain('TV Shows');
    expect(previewText).toContain('http://localhost:32400');

    // Mock confirm import response
    await page.route('**/api/config/import/confirm', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Configuration imported successfully',
        }),
      });
    });

    // Confirm import
    const confirmResponsePromise = waitForApiResponse(
      page,
      '/api/config/import/confirm'
    );
    await configPage.confirmImport();
    await confirmResponsePromise;

    // Verify import success
    await expect(page.locator('[data-testid="import-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-success"]')).toContainText(
      'Configuration imported successfully'
    );
  });

  test('should validate import file before importing', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Create invalid YAML file
    const invalidYaml = 'invalid:\n  yaml content\n    - missing colon';
    const invalidFilePath = await createTempFile(
      invalidYaml,
      'invalid-import.yml'
    );

    // Mock validation failure
    await page.route('**/api/config/import', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: false,
          error: 'Invalid YAML syntax at line 3',
        }),
      });
    });

    // Upload invalid file
    await configPage.uploadImportFile(invalidFilePath);

    // Verify validation error
    await expect(page.locator('[data-testid="import-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-error"]')).toContainText(
      'Invalid YAML syntax at line 3'
    );

    // Confirm button should not be visible
    await expect(
      page.locator('button:has-text("Confirm Import")')
    ).not.toBeVisible();
  });

  test('should handle large import files', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Create large config file
    const largeConfig = testData.yaml.large;
    const largeFilePath = await createTempFile(largeConfig, 'large-import.yml');

    // Mock import response
    await page.route('**/api/config/import', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          preview: {
            libraries: ['Movies', 'TV Shows'],
            size: '2.5 MB',
            lineCount: 5000,
          },
          valid: true,
          warning: 'Large configuration file detected',
        }),
      });
    });

    // Upload large file
    await configPage.uploadImportFile(largeFilePath);

    // Verify warning is shown
    await expect(page.locator('[data-testid="import-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-warning"]')).toContainText(
      'Large configuration file detected'
    );

    // Preview should still work
    const previewText = await configPage.getImportPreview();
    expect(previewText).toContain('2.5 MB');
  });

  test('should create backup before importing', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Create test import file
    const importConfig = generateValidYamlConfig();
    const importFilePath = await createTempFile(
      importConfig,
      'test-import.yml'
    );

    // Mock responses
    await page.route('**/api/config/import', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ preview: { valid: true }, valid: true }),
      });
    });

    let backupCreated = false;
    await page.route('**/api/config/import/confirm', async (route) => {
      const body = await route.request().postDataJSON();
      backupCreated = body.createBackup === true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          backupFile: 'config-backup-2024-01-01.yml',
        }),
      });
    });

    // Upload and import
    await configPage.uploadImportFile(importFilePath);
    await page.waitForSelector('[data-testid="import-preview"]');

    // Ensure backup checkbox is checked
    const backupCheckbox = page.locator('input[name="createBackup"]');
    await expect(backupCheckbox).toBeChecked();

    // Confirm import
    await configPage.confirmImport();

    // Verify backup was created
    expect(backupCreated).toBe(true);
    await expect(page.locator('[data-testid="backup-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="backup-info"]')).toContainText(
      'config-backup-2024-01-01.yml'
    );
  });

  test('should show diff between current and imported config', async ({
    page,
  }) => {
    await configPage.navigateToImportExport();

    // Create test import file
    const importConfig = generateValidYamlConfig();
    const importFilePath = await createTempFile(
      importConfig,
      'test-import.yml'
    );

    // Mock import with diff
    await page.route('**/api/config/import', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          preview: { valid: true },
          valid: true,
          diff: {
            added: ['libraries.Music', 'settings.new_option'],
            removed: ['settings.old_option'],
            modified: ['plex.url', 'libraries.Movies.operations'],
          },
        }),
      });
    });

    // Upload file
    await configPage.uploadImportFile(importFilePath);

    // Click to show diff
    await page.click('button:has-text("Show Differences")');

    // Verify diff is displayed
    await expect(page.locator('[data-testid="config-diff"]')).toBeVisible();
    await expect(page.locator('.diff-added')).toContainText('libraries.Music');
    await expect(page.locator('.diff-removed')).toContainText(
      'settings.old_option'
    );
    await expect(page.locator('.diff-modified')).toContainText('plex.url');
  });

  test('should support drag and drop import', async ({ page }) => {
    await configPage.navigateToImportExport();

    // Create test file
    const importConfig = generateValidYamlConfig();
    const importFilePath = await createTempFile(importConfig, 'drag-drop.yml');

    // Mock import response
    await page.route('**/api/config/import', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ preview: { valid: true }, valid: true }),
      });
    });

    // Simulate drag and drop
    const dropZone = page.locator('[data-testid="drop-zone"]');
    await expect(dropZone).toBeVisible();

    // Create file data for drag and drop
    const buffer = await fs.readFile(importFilePath);
    const dataTransfer = await page.evaluateHandle((data) => {
      const dt = new DataTransfer();
      const file = new File([new Uint8Array(data)], 'drag-drop.yml', {
        type: 'text/yaml',
      });
      dt.items.add(file);
      return dt;
    }, Array.from(buffer));

    // Dispatch drop event
    await dropZone.dispatchEvent('drop', { dataTransfer });

    // Verify file was processed
    await page.waitForSelector('[data-testid="import-preview"]', {
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="file-name"]')).toContainText(
      'drag-drop.yml'
    );
  });
});
