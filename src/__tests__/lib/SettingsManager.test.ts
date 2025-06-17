import { SettingsManager } from '../../lib/SettingsManager';
import { FileStorageService } from '../../lib/FileStorageService';
import { DEFAULT_SETTINGS, Settings } from '../../lib/schemas/settings';
import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';

describe('SettingsManager', () => {
  let manager: SettingsManager;
  let fileStorage: FileStorageService;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, `test-settings-${randomUUID()}`);
    await fs.mkdir(testDir, { recursive: true });
    fileStorage = new FileStorageService(testDir);
    manager = new SettingsManager(fileStorage);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadSettings', () => {
    it('should return default settings when no settings file exists', async () => {
      const settings = await manager.loadSettings();

      expect(settings).toEqual(
        expect.objectContaining({
          app: expect.objectContaining(DEFAULT_SETTINGS.app),
          user: expect.objectContaining(DEFAULT_SETTINGS.user),
          system: expect.objectContaining(DEFAULT_SETTINGS.system),
          version: DEFAULT_SETTINGS.version,
        })
      );
    });

    it('should load valid settings from file', async () => {
      const testSettings: Settings = {
        ...DEFAULT_SETTINGS,
        app: { ...DEFAULT_SETTINGS.app, theme: 'dark' },
        user: { ...DEFAULT_SETTINGS.user, sidebarCollapsed: true },
      };

      await fileStorage.writeJSON('settings/settings.json', testSettings);

      const settings = await manager.loadSettings();

      expect(settings.app.theme).toBe('dark');
      expect(settings.user.sidebarCollapsed).toBe(true);
    });

    it('should use cached settings on subsequent calls', async () => {
      const testSettings = {
        ...DEFAULT_SETTINGS,
        app: { ...DEFAULT_SETTINGS.app, theme: 'dark' as const },
      };
      await fileStorage.writeJSON('settings/settings.json', testSettings);

      const settings1 = await manager.loadSettings();

      // Modify the file after caching
      await fileStorage.writeJSON('settings/settings.json', {
        ...testSettings,
        app: { ...testSettings.app, theme: 'light' as const },
      });

      const settings2 = await manager.loadSettings();

      // Should return cached version
      expect(settings1.app.theme).toBe('dark');
      expect(settings2.app.theme).toBe('dark');
    });

    it('should create default settings when existing file is invalid', async () => {
      await fileStorage.writeJSON('settings/settings.json', {
        invalid: 'data',
      });

      const settings = await manager.loadSettings();

      expect(settings).toEqual(expect.objectContaining(DEFAULT_SETTINGS));
    });
  });

  describe('saveSettings', () => {
    it('should save valid settings', async () => {
      const testSettings: Settings = {
        ...DEFAULT_SETTINGS,
        app: { ...DEFAULT_SETTINGS.app, theme: 'dark' },
      };

      const success = await manager.saveSettings(testSettings);

      expect(success).toBe(true);

      const savedResult = await fileStorage.readJSON<Settings>(
        'settings/settings.json'
      );
      expect(savedResult.success).toBe(true);
      expect(savedResult.data?.app.theme).toBe('dark');
    });

    it('should add lastUpdated timestamp when saving', async () => {
      const testSettings: Settings = {
        ...DEFAULT_SETTINGS,
        lastUpdated: undefined,
      };

      await manager.saveSettings(testSettings);

      const savedResult = await fileStorage.readJSON<Settings>(
        'settings/settings.json'
      );
      expect(savedResult.success).toBe(true);
      expect(savedResult.data?.lastUpdated).toBeDefined();
      expect(new Date(savedResult.data!.lastUpdated!)).toBeInstanceOf(Date);
    });

    it('should throw error for invalid settings', async () => {
      const invalidSettings = {
        ...DEFAULT_SETTINGS,
        app: { ...DEFAULT_SETTINGS.app, theme: 'invalid' },
      } as unknown as Settings;

      await expect(manager.saveSettings(invalidSettings)).rejects.toThrow(
        'Invalid settings'
      );
    });

    it('should create backup before saving when settings exist', async () => {
      // Save initial settings
      await manager.saveSettings(DEFAULT_SETTINGS);

      // Update settings
      const updatedSettings = {
        ...DEFAULT_SETTINGS,
        app: { ...DEFAULT_SETTINGS.app, theme: 'dark' as const },
      };
      await manager.saveSettings(updatedSettings);

      // Check if backup was created
      const backups = await manager.listBackups();
      expect(backups.length).toBeGreaterThan(0);
    });
  });

  describe('updateSettings', () => {
    it('should merge partial settings with existing settings', async () => {
      await manager.saveSettings(DEFAULT_SETTINGS);

      const partialUpdate = {
        app: { theme: 'dark' as const },
        user: { sidebarCollapsed: true },
      };

      const success = await manager.updateSettings(partialUpdate);

      expect(success).toBe(true);

      const updatedSettings = await manager.loadSettings();
      expect(updatedSettings.app.theme).toBe('dark');
      expect(updatedSettings.user.sidebarCollapsed).toBe(true);
      // Other settings should remain unchanged
      expect(updatedSettings.app.pollingInterval).toBe(
        DEFAULT_SETTINGS.app.pollingInterval
      );
    });
  });

  describe('validateSettings', () => {
    it('should validate correct settings', () => {
      const result = manager.validateSettings(DEFAULT_SETTINGS);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(DEFAULT_SETTINGS);
    });

    it('should return errors for invalid settings', () => {
      const invalidSettings = {
        app: { theme: 'invalid' },
      };

      const result = manager.validateSettings(invalidSettings);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('resetToDefaults', () => {
    it('should reset settings to defaults', async () => {
      // Save custom settings
      const customSettings = {
        ...DEFAULT_SETTINGS,
        app: { ...DEFAULT_SETTINGS.app, theme: 'dark' as const },
      };
      await manager.saveSettings(customSettings);

      // Reset to defaults
      const success = await manager.resetToDefaults();

      expect(success).toBe(true);

      const resetSettings = await manager.loadSettings();
      expect(resetSettings.app.theme).toBe(DEFAULT_SETTINGS.app.theme);
    });
  });

  describe('backups', () => {
    it('should create backup of current settings', async () => {
      await manager.saveSettings(DEFAULT_SETTINGS);

      const backupPath = await manager.createBackup();

      expect(backupPath).toBeDefined();
      expect(backupPath).toContain('settings-');
      expect(backupPath).toContain('.json');

      const backupExists = await fileStorage.exists(backupPath!);
      expect(backupExists).toBe(true);
    });

    it('should list backups in reverse chronological order', async () => {
      await manager.saveSettings(DEFAULT_SETTINGS);

      // Create multiple backups
      await manager.createBackup();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different timestamps
      await manager.createBackup();

      const backups = await manager.listBackups();

      expect(backups.length).toBeGreaterThanOrEqual(2);
      // Should be sorted with most recent first
      expect(backups[0]! > backups[1]!).toBe(true);
    });

    it('should restore settings from backup', async () => {
      // Save initial settings
      const originalSettings = {
        ...DEFAULT_SETTINGS,
        app: { ...DEFAULT_SETTINGS.app, theme: 'dark' as const },
      };
      await manager.saveSettings(originalSettings);

      // Create backup
      const backupPath = await manager.createBackup();
      expect(backupPath).toBeDefined();

      // Change settings
      const changedSettings = {
        ...DEFAULT_SETTINGS,
        app: { ...DEFAULT_SETTINGS.app, theme: 'light' as const },
      };
      await manager.saveSettings(changedSettings);

      // Restore from backup
      const backupFileName = path.basename(backupPath!);
      const success = await manager.restoreFromBackup(backupFileName);

      expect(success).toBe(true);

      manager.clearCache(); // Clear cache to force reload
      const restoredSettings = await manager.loadSettings();
      expect(restoredSettings.app.theme).toBe('dark');
    });

    it('should cleanup old backups', async () => {
      await manager.saveSettings(DEFAULT_SETTINGS);

      // Create more backups than retention limit
      const retentionLimit = DEFAULT_SETTINGS.system.backupRetention;
      for (let i = 0; i < retentionLimit + 3; i++) {
        await manager.createBackup();
        await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different timestamps
      }

      await manager.cleanupOldBackups();

      const backups = await manager.listBackups();
      expect(backups.length).toBe(retentionLimit);
    });
  });

  describe('migration', () => {
    it('should update version during migration', async () => {
      await manager.saveSettings(DEFAULT_SETTINGS);

      const success = await manager.migrateSettings('1.0.0', '2.0.0');

      expect(success).toBe(true);

      manager.clearCache();
      const migratedSettings = await manager.loadSettings();
      expect(migratedSettings.version).toBe('2.0.0');
    });
  });

  describe('utility methods', () => {
    it('should clear cache', async () => {
      await manager.loadSettings(); // Load and cache

      manager.clearCache();

      // This should reload from file (we can't directly test cache state)
      const settings = await manager.loadSettings();
      expect(settings).toBeDefined();
    });

    it('should return correct settings path', () => {
      const path = manager.getSettingsPath();
      expect(path).toBe('settings/settings.json');
    });
  });
});
