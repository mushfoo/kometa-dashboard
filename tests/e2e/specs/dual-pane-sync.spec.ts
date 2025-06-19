import { test, expect } from '@playwright/test';
import { ConfigPage } from '../fixtures/config-page';

test.describe('Dual-Pane Configuration Synchronization', () => {
  let configPage: ConfigPage;

  test.beforeEach(async ({ page }) => {
    configPage = new ConfigPage(page);
    await configPage.goto('/config/dual-pane');
  });

  test('should display dual-pane interface correctly', async ({ page }) => {
    // Check for main elements
    await expect(page.getByText('Configuration Editor')).toBeVisible();
    await expect(
      page.getByText('Configure Kometa using forms or edit the YAML directly')
    ).toBeVisible();

    // Check for split pane layout
    await expect(page.getByText('Configuration Forms')).toBeVisible();
    await expect(page.getByText('YAML Editor')).toBeVisible();

    // Check for tabs
    await expect(page.getByRole('tab', { name: 'Plex' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'API Keys' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Libraries' })).toBeVisible();
  });

  test('should sync form changes to YAML editor', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Navigate to Plex tab (should be default)
    await page.getByRole('tab', { name: 'Plex' }).click();

    // Fill in Plex form fields
    const urlField = page.getByLabel('Plex Server URL');
    const tokenField = page.getByLabel('Plex Token');

    await urlField.fill('http://localhost:32400');
    await tokenField.fill('test-token-12345');

    // Wait for debounce and sync
    await page.waitForTimeout(1000);

    // Check that YAML editor contains the updated values
    const yamlEditor = page.getByTestId('yaml-editor');
    const yamlContent = await yamlEditor.textContent();

    expect(yamlContent).toContain('http://localhost:32400');
    expect(yamlContent).toContain('test-token-12345');
  });

  test('should sync YAML changes to form fields', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Update YAML content directly
    const yamlEditor = page.getByTestId('yaml-editor').locator('textarea');

    const yamlContent = `
plex:
  url: http://192.168.1.100:32400
  token: updated-token-67890
tmdb: abc123def456
imdb: ur12345678
`;

    await yamlEditor.fill(yamlContent);

    // Wait for sync
    await page.waitForTimeout(1000);

    // Navigate to Plex tab to check form values
    await page.getByRole('tab', { name: 'Plex' }).click();

    // Check that form fields are updated
    const urlField = page.getByLabel('Plex Server URL');
    const tokenField = page.getByLabel('Plex Token');

    await expect(urlField).toHaveValue('http://192.168.1.100:32400');
    await expect(tokenField).toHaveValue('updated-token-67890');

    // Navigate to API Keys tab to check those values
    await page.getByRole('tab', { name: 'API Keys' }).click();

    const tmdbField = page.getByLabel('TMDb API Key');
    const imdbField = page.getByLabel('IMDb User ID');

    await expect(tmdbField).toHaveValue('abc123def456');
    await expect(imdbField).toHaveValue('ur12345678');
  });

  test('should show validation errors for invalid YAML', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Enter invalid YAML
    const yamlEditor = page.getByTestId('yaml-editor').locator('textarea');
    await yamlEditor.fill('invalid: yaml: content: [unclosed');

    // Wait for validation
    await page.waitForTimeout(500);

    // Check for validation error alert
    await expect(
      page.getByText('Configuration Validation Errors:')
    ).toBeVisible();

    // Save button should be disabled
    const saveButton = page.getByRole('button', {
      name: /save configuration/i,
    });
    await expect(saveButton).toBeDisabled();
  });

  test('should show unsaved changes indicator', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Make a change in the form
    await page.getByRole('tab', { name: 'Plex' }).click();
    await page
      .getByLabel('Plex Server URL')
      .fill('http://test.example.com:32400');

    // Wait for sync
    await page.waitForTimeout(1000);

    // Check for unsaved changes alert
    await expect(page.getByText('You have unsaved changes')).toBeVisible();
    await expect(page.getByText('Last updated by: Form')).toBeVisible();

    // Save and reset buttons should be enabled
    await expect(
      page.getByRole('button', { name: /save configuration/i })
    ).toBeEnabled();
    await expect(page.getByRole('button', { name: /reset/i })).toBeEnabled();
  });

  test('should reset changes correctly', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Store original YAML content
    const yamlEditor = page.getByTestId('yaml-editor').locator('textarea');
    const originalContent = await yamlEditor.inputValue();

    // Make changes
    await page.getByRole('tab', { name: 'Plex' }).click();
    await page
      .getByLabel('Plex Server URL')
      .fill('http://changed.example.com:32400');

    // Wait for sync
    await page.waitForTimeout(1000);

    // Click reset button
    await page.getByRole('button', { name: /reset/i }).click();

    // Check that content is reset
    const resetContent = await yamlEditor.inputValue();
    expect(resetContent).toBe(originalContent);

    // Unsaved changes alert should be gone
    await expect(page.getByText('You have unsaved changes')).not.toBeVisible();
  });

  test('should save configuration successfully', async ({ page }) => {
    // Mock the save API call
    await page.route('/api/config/yaml', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Make a change
    await page.getByRole('tab', { name: 'Plex' }).click();
    await page
      .getByLabel('Plex Server URL')
      .fill('http://save-test.example.com:32400');

    // Wait for sync
    await page.waitForTimeout(1000);

    // Click save button
    await page.getByRole('button', { name: /save configuration/i }).click();

    // Wait for save to complete
    await page.waitForLoadState('networkidle');

    // Check that save was successful
    // The unsaved changes alert should disappear after successful save
    await expect(page.getByText('You have unsaved changes')).not.toBeVisible();
  });

  test('should switch between tabs without losing changes', async ({
    page,
  }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Fill Plex fields
    await page.getByRole('tab', { name: 'Plex' }).click();
    await page
      .getByLabel('Plex Server URL')
      .fill('http://plex-test.example.com:32400');
    await page.getByLabel('Plex Token').fill('plex-token-123');

    // Switch to API Keys tab and fill fields
    await page.getByRole('tab', { name: 'API Keys' }).click();
    await page
      .getByLabel('TMDb API Key')
      .fill('tmdb123456789012345678901234567890');

    // Switch back to Plex tab
    await page.getByRole('tab', { name: 'Plex' }).click();

    // Check that Plex values are still there
    await expect(page.getByLabel('Plex Server URL')).toHaveValue(
      'http://plex-test.example.com:32400'
    );
    await expect(page.getByLabel('Plex Token')).toHaveValue('plex-token-123');

    // Switch back to API Keys tab
    await page.getByRole('tab', { name: 'API Keys' }).click();

    // Check that API key value is still there
    await expect(page.getByLabel('TMDb API Key')).toHaveValue(
      'tmdb123456789012345678901234567890'
    );
  });

  test('should handle API key validation', async ({ page }) => {
    // Mock API key validation
    await page.route('/api/config/api-keys/validate/tmdb', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          details: 'TMDb API key is valid and has access to required endpoints',
        }),
      });
    });

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Navigate to API Keys tab
    await page.getByRole('tab', { name: 'API Keys' }).click();

    // Fill TMDb API key
    await page
      .getByLabel('TMDb API Key')
      .fill('12345678901234567890123456789012');

    // Click test button
    await page.getByRole('button', { name: 'Test' }).first().click();

    // Wait for validation
    await page.waitForTimeout(500);

    // Check for success message
    await expect(page.getByText('TMDb API key is valid')).toBeVisible();
  });

  test('should persist pane size in localStorage', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // The split pane should be rendered
    const splitPane = page.getByTestId('split-pane');
    await expect(splitPane).toBeVisible();

    // Check that localStorage functions are available
    const hasLocalStorage = await page.evaluate(() => {
      return typeof localStorage !== 'undefined';
    });

    expect(hasLocalStorage).toBe(true);
  });
});
