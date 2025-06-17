import { FileStorageService } from './FileStorageService';
import { Settings, SettingsSchema, DEFAULT_SETTINGS } from './schemas/settings';
import { z } from 'zod';

export interface SettingsValidationResult {
  success: boolean;
  data?: Settings;
  errors?: z.ZodError;
}

export class SettingsManager {
  private fileStorage: FileStorageService;
  private readonly settingsPath = 'settings/settings.json';
  private readonly backupPrefix = 'settings/backups/settings';
  private cachedSettings: Settings | null = null;

  constructor(fileStorage?: FileStorageService) {
    this.fileStorage = fileStorage ?? new FileStorageService();
  }

  async loadSettings(): Promise<Settings> {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    const result = await this.fileStorage.readJSON<Settings>(this.settingsPath);

    if (!result.success) {
      // Settings file doesn't exist or is corrupted, create default
      await this.saveSettings(DEFAULT_SETTINGS);
      this.cachedSettings = DEFAULT_SETTINGS;
      return DEFAULT_SETTINGS;
    }

    const validation = this.validateSettings(result.data!);

    if (!validation.success) {
      // Settings are invalid, backup the corrupted file and create default
      await this.createBackup();
      await this.saveSettings(DEFAULT_SETTINGS);
      this.cachedSettings = DEFAULT_SETTINGS;
      return DEFAULT_SETTINGS;
    }

    this.cachedSettings = validation.data!;
    return this.cachedSettings;
  }

  async saveSettings(settings: Settings): Promise<boolean> {
    const validation = this.validateSettings(settings);

    if (!validation.success) {
      throw new Error(`Invalid settings: ${validation.errors?.message}`);
    }

    // Create backup before saving
    if (await this.fileStorage.exists(this.settingsPath)) {
      await this.createBackup();
    }

    const settingsWithTimestamp = {
      ...validation.data!,
      lastUpdated: new Date().toISOString(),
    };

    const result = await this.fileStorage.writeJSONWithRetry(
      this.settingsPath,
      settingsWithTimestamp
    );

    if (result.success) {
      this.cachedSettings = settingsWithTimestamp;
      await this.cleanupOldBackups();
      return true;
    }

    return false;
  }

  async updateSettings(partialSettings: Partial<Settings>): Promise<boolean> {
    const currentSettings = await this.loadSettings();

    const updatedSettings: Settings = {
      ...currentSettings,
      ...partialSettings,
      app: partialSettings.app
        ? { ...currentSettings.app, ...partialSettings.app }
        : currentSettings.app,
      user: partialSettings.user
        ? { ...currentSettings.user, ...partialSettings.user }
        : currentSettings.user,
      system: partialSettings.system
        ? { ...currentSettings.system, ...partialSettings.system }
        : currentSettings.system,
    };

    return this.saveSettings(updatedSettings);
  }

  validateSettings(settings: unknown): SettingsValidationResult {
    try {
      const validatedSettings = SettingsSchema.parse(settings);
      return { success: true, data: validatedSettings };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, errors: error };
      }
      throw error;
    }
  }

  async resetToDefaults(): Promise<boolean> {
    await this.createBackup();
    this.cachedSettings = null;
    return this.saveSettings(DEFAULT_SETTINGS);
  }

  async createBackup(): Promise<string | null> {
    if (!(await this.fileStorage.exists(this.settingsPath))) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.backupPrefix}-${timestamp}.json`;

    const currentSettings = await this.fileStorage.readJSON(this.settingsPath);
    if (currentSettings.success) {
      await this.fileStorage.writeJSON(backupPath, currentSettings.data);
      return backupPath;
    }

    return null;
  }

  async listBackups(): Promise<string[]> {
    const result = await this.fileStorage.listFiles('settings/backups');

    if (!result.success || !result.data) {
      return [];
    }

    return result.data
      .filter((file) => file.startsWith('settings-') && file.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first
  }

  async restoreFromBackup(backupFileName: string): Promise<boolean> {
    const backupPath = `settings/backups/${backupFileName}`;

    if (!(await this.fileStorage.exists(backupPath))) {
      throw new Error(`Backup file not found: ${backupFileName}`);
    }

    const backupData = await this.fileStorage.readJSON<Settings>(backupPath);

    if (!backupData.success) {
      throw new Error(`Failed to read backup: ${backupData.error}`);
    }

    const validation = this.validateSettings(backupData.data!);

    if (!validation.success) {
      throw new Error(
        `Backup contains invalid settings: ${validation.errors?.message}`
      );
    }

    return this.saveSettings(validation.data!);
  }

  async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups();
    const maxBackups =
      this.cachedSettings?.system.backupRetention ??
      DEFAULT_SETTINGS.system.backupRetention;

    if (backups.length <= maxBackups) {
      return;
    }

    const backupsToDelete = backups.slice(maxBackups);

    for (const backup of backupsToDelete) {
      await this.fileStorage.deleteFile(`settings/backups/${backup}`);
    }
  }

  async migrateSettings(
    fromVersion: string,
    toVersion: string
  ): Promise<boolean> {
    // Placeholder for future schema migrations
    // This would contain version-specific migration logic

    const currentSettings = await this.loadSettings();

    // For now, just update the version
    const migratedSettings = {
      ...currentSettings,
      version: toVersion,
    };

    return this.saveSettings(migratedSettings);
  }

  clearCache(): void {
    this.cachedSettings = null;
  }

  getSettingsPath(): string {
    return this.settingsPath;
  }
}

export const settingsManager = new SettingsManager();
