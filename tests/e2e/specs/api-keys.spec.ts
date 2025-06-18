import { test, expect } from '@playwright/test';
import { ConfigPage } from '../fixtures/config-page';
import { testData } from '../fixtures/test-data';
import { setupMockServer, waitForApiResponse } from '../utils/test-helpers';

test.describe('API Keys Management', () => {
  let configPage: ConfigPage;

  test.beforeEach(async ({ page }) => {
    configPage = new ConfigPage(page);
    await setupMockServer(page);
  });

  test('should manage TMDb API key', async ({ page }) => {
    await configPage.navigateToApiKeys();

    // Verify page loaded
    await expect(page).toHaveTitle(/API Keys/);
    await expect(page.locator('h1')).toContainText('API Keys');

    // Select TMDb service
    await configPage.selectApiService('tmdb');

    // Verify TMDb form is shown
    await expect(page.locator('[data-testid="tmdb-form"]')).toBeVisible();
    await expect(page.locator('label[for="apiKey"]')).toContainText(
      'TMDb API Key'
    );

    // Fill in API key
    await configPage.fillApiKey(testData.apiKeys.tmdb.valid);

    // Test API key
    const responsePromise = waitForApiResponse(
      page,
      '/api/config/api-keys/validate/tmdb'
    );
    await configPage.clickTestApiKey();
    await responsePromise;

    // Verify validation success
    await configPage.waitForApiKeyResult();
    const result = await page
      .locator('[data-testid="api-key-result"]')
      .textContent();
    expect(result).toContain('TMDb API key is valid');

    // Save API key
    const saveResponsePromise = waitForApiResponse(page, '/api/keys/tmdb');
    await configPage.saveApiKey();
    await saveResponsePromise;

    // Verify save success
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });

  test('should handle invalid TMDb API key', async ({ page }) => {
    await configPage.navigateToApiKeys();
    await configPage.selectApiService('tmdb');

    // Mock validation failure
    await page.route('**/api/config/api-keys/validate/tmdb', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ valid: false, message: 'Invalid API key' }),
      });
    });

    // Fill in invalid API key
    await configPage.fillApiKey(testData.apiKeys.tmdb.invalid);

    // Test API key
    await configPage.clickTestApiKey();

    // Verify validation failure
    await configPage.waitForApiKeyResult();
    const result = await page
      .locator('[data-testid="api-key-result"]')
      .textContent();
    expect(result).toContain('Invalid API key');

    // Save button should be disabled
    await expect(
      page.locator('button:has-text("Save API Key")')
    ).toBeDisabled();
  });

  test('should manage Trakt credentials', async ({ page }) => {
    await configPage.navigateToApiKeys();

    // Select Trakt service
    await configPage.selectApiService('trakt');

    // Verify Trakt form is shown
    await expect(page.locator('[data-testid="trakt-form"]')).toBeVisible();
    await expect(page.locator('label[for="clientId"]')).toContainText(
      'Client ID'
    );
    await expect(page.locator('label[for="clientSecret"]')).toContainText(
      'Client Secret'
    );

    // Fill in credentials
    await page.fill(
      'input[name="clientId"]',
      testData.apiKeys.trakt.validClientId
    );
    await page.fill(
      'input[name="clientSecret"]',
      testData.apiKeys.trakt.validClientSecret
    );

    // Test credentials
    const responsePromise = waitForApiResponse(
      page,
      '/api/config/api-keys/validate/trakt'
    );
    await configPage.clickTestApiKey();
    await responsePromise;

    // Verify validation success
    await configPage.waitForApiKeyResult();
    const result = await page
      .locator('[data-testid="api-key-result"]')
      .textContent();
    expect(result).toContain('Trakt credentials are valid');

    // Save credentials
    await configPage.saveApiKey();

    // Verify save success
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });

  test('should mask saved API keys', async ({ page }) => {
    // First save an API key
    await configPage.navigateToApiKeys();
    await configPage.selectApiService('tmdb');
    await configPage.fillApiKey(testData.apiKeys.tmdb.valid);
    await configPage.clickTestApiKey();
    await configPage.waitForApiKeyResult();
    await configPage.saveApiKey();

    // Reload page
    await page.reload();

    // Select TMDb again
    await configPage.selectApiService('tmdb');

    // Verify API key is masked
    const apiKeyInput = await page.locator('input[name="apiKey"]');
    const value = await apiKeyInput.inputValue();
    expect(value).toMatch(/\*{28}[a-f0-9]{4}$/); // Should show only last 4 characters
  });

  test('should show help links for each service', async ({ page }) => {
    await configPage.navigateToApiKeys();

    // Check TMDb help link
    await configPage.selectApiService('tmdb');
    const tmdbHelpLink = page.locator('a[href*="themoviedb.org"]');
    await expect(tmdbHelpLink).toBeVisible();
    await expect(tmdbHelpLink).toHaveText(/Get TMDb API Key/);

    // Check Trakt help link
    await configPage.selectApiService('trakt');
    const traktHelpLink = page.locator('a[href*="trakt.tv"]');
    await expect(traktHelpLink).toBeVisible();
    await expect(traktHelpLink).toHaveText(/Create Trakt App/);

    // Check IMDb help link
    await configPage.selectApiService('imdb');
    const imdbHelpLink = page.locator('a[href*="imdb.com"]');
    await expect(imdbHelpLink).toBeVisible();
  });

  test('should handle multiple API keys', async ({ page }) => {
    await configPage.navigateToApiKeys();

    // Add TMDb key
    await configPage.selectApiService('tmdb');
    await configPage.fillApiKey(testData.apiKeys.tmdb.valid);
    await configPage.clickTestApiKey();
    await configPage.waitForApiKeyResult();
    await configPage.saveApiKey();

    // Add Trakt credentials
    await configPage.selectApiService('trakt');
    await page.fill(
      'input[name="clientId"]',
      testData.apiKeys.trakt.validClientId
    );
    await page.fill(
      'input[name="clientSecret"]',
      testData.apiKeys.trakt.validClientSecret
    );
    await configPage.clickTestApiKey();
    await configPage.waitForApiKeyResult();
    await configPage.saveApiKey();

    // Verify both are saved
    await page.reload();

    // Check TMDb
    await configPage.selectApiService('tmdb');
    const tmdbInput = await page.locator('input[name="apiKey"]');
    await expect(tmdbInput).toHaveValue(/\*{28}[a-f0-9]{4}$/);

    // Check Trakt
    await configPage.selectApiService('trakt');
    const traktIdInput = await page.locator('input[name="clientId"]');
    await expect(traktIdInput).not.toBeEmpty();
  });

  test('should delete API key', async ({ page }) => {
    // First save an API key
    await configPage.navigateToApiKeys();
    await configPage.selectApiService('tmdb');
    await configPage.fillApiKey(testData.apiKeys.tmdb.valid);
    await configPage.clickTestApiKey();
    await configPage.waitForApiKeyResult();
    await configPage.saveApiKey();

    // Delete the key
    const deleteButton = page.locator('button:has-text("Delete")');
    await expect(deleteButton).toBeVisible();

    // Mock delete confirmation
    page.on('dialog', (dialog) => dialog.accept());

    const deleteResponsePromise = waitForApiResponse(
      page,
      '/api/keys/tmdb',
      200
    );
    await deleteButton.click();
    await deleteResponsePromise;

    // Verify key is deleted
    await expect(page.locator('[data-testid="delete-success"]')).toBeVisible();

    // Input should be empty now
    const apiKeyInput = await page.locator('input[name="apiKey"]');
    await expect(apiKeyInput).toHaveValue('');
  });
});
