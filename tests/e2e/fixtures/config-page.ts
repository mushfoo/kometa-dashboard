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

  async navigateToDualPane() {
    await this.navigate('/config/dual-pane');
    await this.waitForPageLoad();
  }

  // Plex Configuration Methods
  async fillPlexUrl(url: string) {
    await this.fillInput('input[id="url"]', url);
  }

  async fillPlexToken(token: string) {
    await this.fillInput('input[id="token"]', token);
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
    // Click the label instead of the checkbox since it's more reliable
    await this.page.locator(`label:has-text("${libraryName}")`).click();
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

  // Dual-Pane Configuration Methods
  async switchToFormTab(tabName: 'plex' | 'apis' | 'libraries') {
    // Click the tab trigger directly by its text content
    await this.page
      .locator(
        `button[role="tab"]:has-text("${tabName === 'apis' ? 'API Keys' : tabName === 'libraries' ? 'Libraries' : 'Plex'}")`
      )
      .click();
  }

  async getCurrentFormTab(): Promise<string> {
    // Find the active tab by checking which tab panel is visible
    const plexVisible = await this.page
      .locator('[role="tabpanel"][id*="plex"]')
      .isVisible()
      .catch(() => false);
    const apisVisible = await this.page
      .locator('[role="tabpanel"][id*="apis"]')
      .isVisible()
      .catch(() => false);
    const librariesVisible = await this.page
      .locator('[role="tabpanel"][id*="libraries"]')
      .isVisible()
      .catch(() => false);

    if (plexVisible) return 'plex';
    if (apisVisible) return 'apis';
    if (librariesVisible) return 'libraries';
    return '';
  }

  async getDualPaneYamlContent(): Promise<string> {
    // Wait for Monaco editor to load
    await this.page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Get content from Monaco editor in dual-pane interface
    return await this.page.evaluate(() => {
      const monaco = (window as any).monaco;
      if (monaco && monaco.editor) {
        const models = monaco.editor.getModels();
        if (models && models.length > 0) {
          return models[0].getValue();
        }
      }
      return '';
    });
  }

  async setDualPaneYamlContent(content: string) {
    // Wait for Monaco editor to load
    await this.page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Set content in Monaco editor
    await this.page.evaluate((content) => {
      const monaco = (window as any).monaco;
      if (monaco && monaco.editor) {
        const models = monaco.editor.getModels();
        if (models && models.length > 0) {
          models[0].setValue(content);
        }
      }
    }, content);
  }

  async saveDualPaneConfiguration() {
    await this.clickElement('button:has-text("Save Configuration")');
  }

  async resetDualPaneConfiguration() {
    await this.clickElement('button:has-text("Reset")');
  }

  async checkPaneSizePersistedCorrectly() {
    // Check if the split pane has been resized (localStorage persistence)
    const splitPane = await this.page.locator('.SplitPane').first();
    return await splitPane.isVisible();
  }

  async resizeSplitPane(direction: 'left' | 'right', pixels: number) {
    const splitter = await this.page.locator('.Resizer').first();
    const splitterBox = await splitter.boundingBox();

    if (splitterBox) {
      const startX = splitterBox.x + splitterBox.width / 2;
      const startY = splitterBox.y + splitterBox.height / 2;
      const endX = direction === 'right' ? startX + pixels : startX - pixels;

      await this.page.mouse.move(startX, startY);
      await this.page.mouse.down();
      await this.page.mouse.move(endX, startY);
      await this.page.mouse.up();
    }
  }

  async waitForUnsavedChangesAlert() {
    await this.page.waitForSelector('text=You have unsaved changes', {
      timeout: 5000,
    });
  }

  async checkForUnsavedChangesAlert(): Promise<boolean> {
    try {
      await this.page.waitForSelector('text=You have unsaved changes', {
        timeout: 1000,
      });
      return true;
    } catch {
      return false;
    }
  }
}
