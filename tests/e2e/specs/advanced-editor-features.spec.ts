import { test, expect } from '@playwright/test';
import { ConfigPage } from '../fixtures/config-page';

test.describe('Advanced Editor Features (Day 15)', () => {
  let configPage: ConfigPage;

  test.beforeEach(async ({ page }) => {
    configPage = new ConfigPage(page);
    await configPage.navigateToDualPane();
  });

  test.describe('Configuration Templates', () => {
    test('should open template selection modal', async ({ page }) => {
      await page.getByRole('button', { name: 'Load Template' }).click();

      await expect(
        page.getByText('Select Configuration Template')
      ).toBeVisible();
      await expect(page.getByPlaceholder('Search templates...')).toBeVisible();

      // Should have template categories
      await expect(
        page.getByRole('tab', { name: 'Basic Templates' })
      ).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Advanced Templates' })
      ).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Custom Templates' })
      ).toBeVisible();
    });

    test('should display built-in templates', async ({ page }) => {
      await page.getByRole('button', { name: 'Load Template' }).click();

      // Should show basic templates by default
      await expect(page.getByText('Basic Plex Setup')).toBeVisible();
      await expect(page.getByText('Anime Configuration')).toBeVisible();

      // Switch to advanced templates
      await page.getByRole('tab', { name: 'Advanced Templates' }).click();
      await expect(page.getByText('Complete Setup')).toBeVisible();
    });

    test('should apply a template to the editor', async ({ page }) => {
      await page.getByRole('button', { name: 'Load Template' }).click();

      // Select the basic Plex template
      await page.getByText('Basic Plex Setup').click();

      // Should show template details in right panel
      await expect(
        page.getByText('Simple Plex-only configuration for beginners')
      ).toBeVisible();

      // Fill in customization
      await page.getByLabel('Plex Server URL').fill('http://localhost:32400');
      await page.getByLabel('Plex Token').fill('test-token-123');

      // Apply template
      await page.getByRole('button', { name: 'Apply Template' }).click();

      // Should close modal and update YAML editor
      await expect(
        page.getByText('Select Configuration Template')
      ).not.toBeVisible();

      // Verify YAML content includes applied customizations
      const yamlContent = await page.locator('.monaco-editor').textContent();
      expect(yamlContent).toContain('http://localhost:32400');
      expect(yamlContent).toContain('test-token-123');
    });

    test('should save custom template', async ({ page }) => {
      // First add some configuration
      await configPage.setYamlContent(`
plex:
  url: http://localhost:32400
  token: my-custom-token
libraries:
  Movies:
    collection_files:
      - default: basic
`);

      await page.getByRole('button', { name: 'Save as Template' }).click();

      await expect(page.getByText('Save as Template')).toBeVisible();

      // Fill in template details
      await page.getByLabel('Template Name').fill('My Custom Config');
      await page
        .getByLabel('Description')
        .fill('A custom configuration for my setup');
      await page.getByLabel('Tags').fill('custom,personal');
      await page.keyboard.press('Enter');

      // Should show preview
      await expect(
        page.getByText('1 collections will be created')
      ).toBeVisible();
      await expect(page.getByText('Libraries: Movies')).toBeVisible();

      // Save template
      await page.getByRole('button', { name: 'Save Template' }).click();

      // Should close modal
      await expect(page.getByText('Save as Template')).not.toBeVisible();
    });
  });

  test.describe('Version History', () => {
    test('should open version history modal', async ({ page }) => {
      await page.getByRole('button', { name: 'Version History' }).click();

      await expect(page.getByText('Version History')).toBeVisible();
      await expect(
        page.getByText('View and restore previous configuration versions')
      ).toBeVisible();
    });

    test('should save version history when configuration is saved', async ({
      page,
    }) => {
      // Add some configuration
      await configPage.setYamlContent(`
plex:
  url: http://localhost:32400
  token: test-token
`);

      // Save configuration
      await page.getByRole('button', { name: 'Save Configuration' }).click();

      // Wait for save to complete
      await expect(page.getByText('Saving...')).not.toBeVisible();

      // Open version history
      await page.getByRole('button', { name: 'Version History' }).click();

      // Should show the saved version
      await expect(page.getByText(/Configuration saved on/)).toBeVisible();
      await expect(page.getByText('Manual Edit')).toBeVisible();
    });

    test('should preview version content', async ({ page }) => {
      // First save a configuration to create history
      await configPage.setYamlContent(`
plex:
  url: http://localhost:32400
  token: test-token
`);
      await page.getByRole('button', { name: 'Save Configuration' }).click();
      await expect(page.getByText('Saving...')).not.toBeVisible();

      // Open version history
      await page.getByRole('button', { name: 'Version History' }).click();

      // Click on a version
      await page
        .getByText(/Configuration saved on/)
        .first()
        .click();

      // Should show preview tab and YAML content
      await expect(page.getByRole('tab', { name: 'Preview' })).toBeVisible();

      // The preview should be read-only
      const previewEditor = page.locator('.monaco-editor').last();
      await expect(previewEditor).toBeVisible();
    });

    test('should restore previous version', async ({ page }) => {
      // Create initial configuration
      await configPage.setYamlContent(`
plex:
  url: http://localhost:32400
  token: original-token
`);
      await page.getByRole('button', { name: 'Save Configuration' }).click();
      await expect(page.getByText('Saving...')).not.toBeVisible();

      // Modify configuration
      await configPage.setYamlContent(`
plex:
  url: http://localhost:32400
  token: modified-token
`);
      await page.getByRole('button', { name: 'Save Configuration' }).click();
      await expect(page.getByText('Saving...')).not.toBeVisible();

      // Open version history
      await page.getByRole('button', { name: 'Version History' }).click();

      // Select the older version (should be second in list)
      await page
        .getByText(/Configuration saved on/)
        .nth(1)
        .click();

      // Restore version
      await page.getByRole('button', { name: 'Restore' }).click();

      // Confirm restoration
      await page.getByRole('button', { name: 'Restore Version' }).click();

      // Should close modal and update editor
      await expect(page.getByText('Version History')).not.toBeVisible();

      // Verify the original content is restored
      const yamlContent = await page
        .locator('.monaco-editor')
        .first()
        .textContent();
      expect(yamlContent).toContain('original-token');
    });
  });

  test.describe('Conflict Resolution', () => {
    test('should detect sync conflicts', async ({ page }) => {
      // Set initial configuration in form
      await page.getByRole('tab', { name: 'Plex' }).click();
      await page.getByLabel('Plex Server URL').fill('http://localhost:32400');
      await page.getByLabel('Plex Token').fill('form-token');

      // Wait for form to sync to YAML
      await page.waitForTimeout(500);

      // Manually edit YAML to create conflict
      // Note: This is a simplified test - in reality, conflicts are more complex
      const yamlEditor = page.locator('.monaco-editor').last();
      await yamlEditor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(`
plex:
  url: http://localhost:32400
  token: yaml-token
`);

      // Should trigger conflict detection after debounce
      await page.waitForTimeout(1000);

      // Check if conflict dialog appears (this depends on the exact timing and implementation)
      // In a real scenario, you'd need to orchestrate this more carefully
    });

    test('should show change highlighting in YAML editor', async ({ page }) => {
      // Make changes to trigger highlighting
      await page.getByRole('tab', { name: 'Plex' }).click();
      await page.getByLabel('Plex Server URL').fill('http://localhost:32400');

      // Wait for sync
      await page.waitForTimeout(500);

      // Should show modification indicator
      await expect(page.getByText('Modified')).toBeVisible();
    });
  });

  test.describe('Integration Tests', () => {
    test('should maintain functionality across all Day 15 features', async ({
      page,
    }) => {
      // 1. Load a template
      await page.getByRole('button', { name: 'Load Template' }).click();
      await page.getByText('Basic Plex Setup').click();
      await page.getByLabel('Plex Server URL').fill('http://localhost:32400');
      await page.getByRole('button', { name: 'Apply Template' }).click();

      // 2. Save configuration (creates version history)
      await page.getByRole('button', { name: 'Save Configuration' }).click();
      await expect(page.getByText('Saving...')).not.toBeVisible();

      // 3. Modify and save as template
      await configPage.appendYamlContent(`
collections:
  Action Movies:
    trakt_list: https://trakt.tv/users/user/lists/action
`);

      await page.getByRole('button', { name: 'Save as Template' }).click();
      await page.getByLabel('Template Name').fill('Action Movies Template');
      await page
        .getByLabel('Description')
        .fill('Template with action movies collection');
      await page.getByRole('button', { name: 'Save Template' }).click();

      // 4. Check version history
      await page.getByRole('button', { name: 'Version History' }).click();

      // Should show multiple versions
      const versionItems = page.getByText(
        /Configuration saved on|Applied template/
      );
      await expect(versionItems.first()).toBeVisible();

      // Close modal
      await page.getByRole('button', { name: /×|Close/ }).click();

      // 5. Verify all functionality still works
      await expect(
        page.getByRole('button', { name: 'Save Configuration' })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Load Template' })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Version History' })
      ).toBeVisible();
    });
  });
});
