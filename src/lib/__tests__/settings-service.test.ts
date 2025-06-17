import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  SettingsService,
  createSettingsService,
  settingsMigrations,
} from '../settings-service';
import { AppSettings, createDefaultSettings } from '@/types/settings';

describe('SettingsService', () => {
  let tempDir: string;
  let service: SettingsService;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'settings-test-'));
    await fs.mkdir(path.join(tempDir, 'settings'), { recursive: true });
    service = createSettingsService(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('getSettings', () => {
    it('should return default settings on first run', async () => {
      const settings = await service.getSettings();
      const defaults = createDefaultSettings();

      expect(settings).toEqual(defaults);
    });

    it('should cache settings after first read', async () => {
      const settings1 = await service.getSettings();
      const settings2 = await service.getSettings();

      expect(settings1).toBe(settings2); // Same object reference
    });

    it('should persist default settings to disk', async () => {
      await service.getSettings();

      const filePath = path.join(tempDir, 'settings', 'settings.json');
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });
  });

  describe('updateSettings', () => {
    it('should update settings partially', async () => {
      const update = {
        theme: 'dark' as const,
        logLevel: 'debug' as const,
      };

      const updated = await service.updateSettings(update);

      expect(updated.theme).toBe('dark');
      expect(updated.logLevel).toBe('debug');
      expect(updated.lastUpdated).toBeDefined();
    });

    it('should validate settings on update', async () => {
      const invalidUpdate = {
        theme: 'invalid-theme' as any,
      };

      await expect(service.updateSettings(invalidUpdate)).rejects.toThrow();
    });

    it('should create backup before update when enabled', async () => {
      // Make an update (backupBeforeUpdate is true by default)
      await service.updateSettings({ theme: 'dark' });

      const backups = await service.listBackups();
      expect(backups.length).toBeGreaterThan(0);
    });

    it('should update cache after successful update', async () => {
      await service.updateSettings({ theme: 'dark' });

      const settings = await service.getSettings();
      expect(settings.theme).toBe('dark');
    });
  });

  describe('backup and restore', () => {
    it('should create backup with timestamp', async () => {
      await service.getSettings(); // Initialize

      const backupName = await service.createBackup();

      expect(backupName).toBeTruthy();
      expect(backupName).toMatch(
        /^settings-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_\d{3}Z\.json$/
      );
    });

    it('should list backups sorted by date', async () => {
      await service.getSettings();

      // Create multiple backups with delays
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await service.createBackup();
      }

      const backups = await service.listBackups();

      expect(backups).toHaveLength(3);
      expect(backups[0]?.created.getTime()).toBeGreaterThan(
        backups[1]?.created.getTime() ?? 0
      );
      expect(backups[1]?.created.getTime()).toBeGreaterThan(
        backups[2]?.created.getTime() ?? 0
      );
    });

    it('should restore from backup', async () => {
      // Set initial settings
      await service.updateSettings({ theme: 'dark' });

      // Create backup
      const backupName = await service.createBackup();
      expect(backupName).toBeTruthy();

      // Change settings
      await service.updateSettings({ theme: 'light' });

      // Verify the change took effect
      const current = await service.getSettings();
      expect(current.theme).toBe('light');

      // Restore from backup
      const restored = await service.restoreFromBackup(backupName!);

      expect(restored.theme).toBe('dark');
    });

    it('should respect maxBackups limit', async () => {
      await service.updateSettings({
        fileStorage: {
          maxBackups: 2,
          autoBackup: true,
          backupBeforeUpdate: false,
        },
      });

      // Create multiple backups
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await service.createBackup();
      }

      const backups = await service.listBackups();
      expect(backups).toHaveLength(2);
    });
  });

  describe('migrations', () => {
    it('should migrate settings to new version', async () => {
      const current = await service.getSettings();
      expect(current.version).toBe('1.0.0');

      const migrated = await service.migrateSettings(
        '1.1.0',
        settingsMigrations['1.0.0_to_1.1.0']
      );

      expect(migrated.version).toBe('1.1.0');
      expect(migrated.display?.showAdvancedOptions).toBe(false);
    });

    it('should skip migration if already on target version', async () => {
      await service.updateSettings({ version: '1.1.0' });

      const result = await service.migrateSettings(
        '1.1.0',
        (s) => ({ ...s, modified: true }) as any
      );

      expect(result.version).toBe('1.1.0');
      expect((result as any).modified).toBeUndefined();
    });

    it('should record migration history', async () => {
      await service.migrateSettings(
        '1.1.0',
        settingsMigrations['1.0.0_to_1.1.0']
      );

      const migrations = await service.getMigrations();

      expect(migrations).toHaveLength(1);
      expect(migrations[0]?.version).toBe('1.1.0');
      expect(migrations[0]?.from).toBe('1.0.0');
      expect(migrations[0]?.migratedAt).toBeDefined();
    });

    it('should create backup before migration', async () => {
      await service.migrateSettings(
        '1.1.0',
        settingsMigrations['1.0.0_to_1.1.0']
      );

      const backups = await service.listBackups();
      expect(backups.length).toBeGreaterThan(0);
    });
  });

  describe('import/export', () => {
    it('should export settings as JSON', async () => {
      await service.updateSettings({ theme: 'dark', logLevel: 'debug' });

      const exported = await service.exportSettings();
      const parsed = JSON.parse(exported);

      expect(parsed.theme).toBe('dark');
      expect(parsed.logLevel).toBe('debug');
    });

    it('should import valid settings', async () => {
      const settingsToImport: AppSettings = {
        ...createDefaultSettings(),
        theme: 'light',
        logLevel: 'error',
      };

      const imported = await service.importSettings(
        JSON.stringify(settingsToImport)
      );

      expect(imported.theme).toBe('light');
      expect(imported.logLevel).toBe('error');
      expect(imported.lastUpdated).toBeDefined();
    });

    it('should validate imported settings', async () => {
      const invalidSettings = {
        theme: 'invalid-theme',
        version: '1.0.0',
      };

      await expect(
        service.importSettings(JSON.stringify(invalidSettings))
      ).rejects.toThrow();
    });

    it('should create backup before import', async () => {
      await service.getSettings(); // Initialize

      const settingsToImport = createDefaultSettings();
      await service.importSettings(JSON.stringify(settingsToImport));

      const backups = await service.listBackups();
      expect(backups.length).toBeGreaterThan(0);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset settings to defaults', async () => {
      await service.updateSettings({ theme: 'dark', logLevel: 'debug' });

      const reset = await service.resetToDefaults();
      const defaults = createDefaultSettings();

      expect(reset).toEqual(defaults);
    });

    it('should create backup before reset', async () => {
      await service.updateSettings({ theme: 'dark' });

      await service.resetToDefaults();

      const backups = await service.listBackups();
      expect(backups.length).toBeGreaterThan(0);
    });

    it('should clear cache after reset', async () => {
      await service.updateSettings({ theme: 'dark' });
      await service.resetToDefaults();

      const settings = await service.getSettings();
      expect(settings.theme).toBe('system');
    });
  });

  describe('clearCache', () => {
    it('should force reload from disk after cache clear', async () => {
      // Get initial settings (cached)
      await service.getSettings();

      // Modify file directly
      const filePath = path.join(tempDir, 'settings', 'settings.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      parsed.theme = 'dark';
      await fs.writeFile(filePath, JSON.stringify(parsed));

      // Should still return cached version
      const settings2 = await service.getSettings();
      expect(settings2.theme).toBe('system');

      // Clear cache and get again
      service.clearCache();
      const settings3 = await service.getSettings();
      expect(settings3.theme).toBe('dark');
    });
  });
});
