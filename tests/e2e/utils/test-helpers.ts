import { Page } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

export async function waitForApiResponse(
  page: Page,
  url: string | RegExp,
  status = 200
) {
  const response = await page.waitForResponse(
    (resp) => {
      const matches =
        typeof url === 'string'
          ? resp.url().includes(url)
          : url.test(resp.url());
      return matches && resp.status() === status;
    },
    { timeout: 10000 }
  );
  return response;
}

export async function mockApiResponse(
  page: Page,
  url: string,
  response: any,
  status = 200
) {
  await page.route(url, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

export async function createTestConfig() {
  return {
    plex: {
      url: 'http://localhost:32400',
      token: 'test-plex-token-32-characters-long',
    },
    libraries: ['Movies', 'TV Shows'],
    apiKeys: {
      tmdb: 'test-tmdb-key-32-hex-characters-long',
      trakt: {
        client_id: 'test-trakt-client-id',
        client_secret: 'test-trakt-client-secret',
      },
    },
  };
}

export async function createTempFile(
  content: string,
  filename: string
): Promise<string> {
  const tempDir = path.join(process.cwd(), 'tests', 'e2e', 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  const filePath = path.join(tempDir, filename);
  await fs.writeFile(filePath, content);
  return filePath;
}

export async function cleanupTempFiles() {
  const tempDir = path.join(process.cwd(), 'tests', 'e2e', 'temp');
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore if directory doesn't exist
  }
}

export function generateValidYamlConfig(): string {
  return `
libraries:
  Movies:
    collection_files:
      - default: basic
      - default: imdb
    operations:
      mass_genre_update: tmdb
      mass_content_rating_update: mdb_commonsense
  TV Shows:
    collection_files:
      - default: basic
      - default: network
    operations:
      mass_genre_update: tmdb
      mass_episode_content_rating_update: mdb_commonsense
settings:
  cache: true
  cache_expiration: 60
  asset_directory: assets
  asset_folders: true
  create_asset_folders: false
  dimensional_asset_rename: false
  show_missing_season_assets: false
  sync_mode: append
  collection_minimum: 1
  delete_below_minimum: true
  delete_not_scheduled: false
  run_again_delay: 2
  missing_only_released: false
  only_filter_missing: false
  show_unmanaged: true
  show_filtered: false
  show_options: false
  show_missing: true
  show_missing_assets: true
  save_missing: true
plex:
  url: http://localhost:32400
  token: test-token-value
  timeout: 60
  clean_bundles: false
  empty_trash: false
  optimize: false
`;
}

export async function setupMockServer(page: Page) {
  // Mock Plex API responses
  await mockApiResponse(page, '**/api/config/plex/test', {
    success: true,
    libraries: [
      { key: '1', title: 'Movies', type: 'movie' },
      { key: '2', title: 'TV Shows', type: 'show' },
      { key: '3', title: 'Music', type: 'artist' },
    ],
  });

  // Mock API key validation responses
  await mockApiResponse(page, '**/api/config/api-keys/validate/tmdb', {
    valid: true,
    message: 'TMDb API key is valid',
  });

  await mockApiResponse(page, '**/api/config/api-keys/validate/trakt', {
    valid: true,
    message: 'Trakt credentials are valid',
  });

  // Mock YAML validation
  await mockApiResponse(page, '**/api/config/yaml/validate', {
    valid: true,
    message: 'YAML configuration is valid',
  });

  // Mock configuration save responses
  await mockApiResponse(page, '**/api/config', {
    success: true,
    message: 'Configuration saved successfully',
  });
}

export async function takeFailureArtifacts(page: Page, testName: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const artifactsDir = path.join(process.cwd(), 'tests', 'e2e', 'artifacts');

  await fs.mkdir(artifactsDir, { recursive: true });

  // Take screenshot
  await page.screenshot({
    path: path.join(artifactsDir, `${testName}-${timestamp}.png`),
    fullPage: true,
  });

  // Save page HTML
  const html = await page.content();
  await fs.writeFile(
    path.join(artifactsDir, `${testName}-${timestamp}.html`),
    html
  );

  // Save console logs
  const logs: string[] = [];
  page.on('console', (msg) => {
    logs.push(`${msg.type()}: ${msg.text()}`);
  });

  if (logs.length > 0) {
    await fs.writeFile(
      path.join(artifactsDir, `${testName}-${timestamp}-console.log`),
      logs.join('\n')
    );
  }
}
