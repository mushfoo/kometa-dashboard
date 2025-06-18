import { Page } from '@playwright/test';
import { BasePage } from './base-page';

export class ConfigPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToConfig() {
    await this.navigate('/config');
    await this.waitForPageLoad();
  }

  async navigateToPlexConfig() {
    await this.navigate('/config/plex');
    await this.waitForPageLoad();
  }

  async navigateToApiKeys() {
    await this.navigate('/config/api-keys');
    await this.waitForPageLoad();
  }

  async navigateToYamlEditor() {
    await this.navigate('/config/yaml');
    await this.waitForPageLoad();
  }

  async navigateToImportExport() {
    await this.navigate('/config/import-export');
    await this.waitForPageLoad();
  }

  // Plex Configuration Methods
  async fillPlexUrl(url: string) {
    await this.fillInput('input[name="plexUrl"]', url);
  }

  async fillPlexToken(token: string) {
    await this.fillInput('input[name="plexToken"]', token);
  }

  async clickTestConnection() {
    await this.clickElement('button:has-text("Test Connection")');
  }

  async waitForConnectionResult() {
    await this.page.waitForSelector('[data-testid="connection-result"]', {
      timeout: 10000,
    });
  }

  async getConnectionStatus(): Promise<string> {
    return await this.getText('[data-testid="connection-result"]');
  }

  async selectLibrary(libraryName: string) {
    await this.clickElement(`input[type="checkbox"][value="${libraryName}"]`);
  }

  async saveConfiguration() {
    await this.clickElement('button:has-text("Save Configuration")');
  }

  // API Keys Methods
  async selectApiService(service: string) {
    await this.clickElement(`button[data-service="${service}"]`);
  }

  async fillApiKey(key: string) {
    await this.fillInput('input[name="apiKey"]', key);
  }

  async clickTestApiKey() {
    await this.clickElement('button:has-text("Test API Key")');
  }

  async waitForApiKeyResult() {
    await this.page.waitForSelector('[data-testid="api-key-result"]', {
      timeout: 10000,
    });
  }

  async saveApiKey() {
    await this.clickElement('button:has-text("Save API Key")');
  }

  // YAML Editor Methods
  async getYamlContent(): Promise<string> {
    // Monaco editor requires special handling
    const editor = await this.page.locator('.monaco-editor');
    return await editor.evaluate((el: any) => {
      return el._monaco?.editor?.getModels()[0]?.getValue() || '';
    });
  }

  async setYamlContent(content: string) {
    // Monaco editor requires special handling
    await this.page.evaluate((content) => {
      const monaco = (window as any).monaco;
      if (monaco) {
        const editor = monaco.editor.getModels()[0];
        if (editor) {
          editor.setValue(content);
        }
      }
    }, content);
  }

  async validateYaml() {
    await this.clickElement('button:has-text("Validate")');
  }

  async saveYaml() {
    await this.clickElement('button:has-text("Save")');
  }

  // Import/Export Methods
  async clickExport() {
    await this.clickElement('button:has-text("Export Configuration")');
  }

  async uploadImportFile(filePath: string) {
    const fileInput = await this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
  }

  async clickImport() {
    await this.clickElement('button:has-text("Import Configuration")');
  }

  async confirmImport() {
    await this.clickElement('button:has-text("Confirm Import")');
  }

  async getImportPreview(): Promise<string> {
    return await this.getText('[data-testid="import-preview"]');
  }
}
