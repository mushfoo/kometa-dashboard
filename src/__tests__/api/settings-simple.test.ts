import { SettingsManager } from '../../lib/SettingsManager';
import { FileStorageService } from '../../lib/FileStorageService';
import { DEFAULT_SETTINGS } from '../../lib/schemas/settings';
import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';

describe('Settings Integration', () => {
  let manager: SettingsManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, `test-settings-integration-${randomUUID()}`);
    await fs.mkdir(testDir, { recursive: true });
    const fileStorage = new FileStorageService(testDir);
    manager = new SettingsManager(fileStorage);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should handle settings operations end-to-end', async () => {
    // Load default settings
    const settings = await manager.loadSettings();
    expect(settings).toEqual(expect.objectContaining(DEFAULT_SETTINGS));

    // Update settings
    const updated = await manager.updateSettings({
      app: { theme: 'dark' },
    });
    expect(updated).toBe(true);

    // Verify update
    const newSettings = await manager.loadSettings();
    expect(newSettings.app.theme).toBe('dark');

    // Create backup
    const backupPath = await manager.createBackup();
    expect(backupPath).toBeDefined();

    // List backups
    const backups = await manager.listBackups();
    expect(backups.length).toBeGreaterThan(0);

    // Reset to defaults
    const reset = await manager.resetToDefaults();
    expect(reset).toBe(true);

    // Verify reset
    manager.clearCache();
    const resetSettings = await manager.loadSettings();
    expect(resetSettings.app.theme).toBe(DEFAULT_SETTINGS.app.theme);
  });

  it('should validate settings properly', () => {
    const validResult = manager.validateSettings(DEFAULT_SETTINGS);
    expect(validResult.success).toBe(true);

    const invalidResult = manager.validateSettings({ invalid: 'data' });
    expect(invalidResult.success).toBe(false);
  });
});
