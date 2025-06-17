import path from 'path';
import { z } from 'zod';
import {
  AppSettings,
  AppSettingsSchema,
  AppSettingsUpdate,
  createDefaultSettings,
  SettingsMigration,
  SettingsMigrationSchema,
} from '@/types/settings';
import { createTypedStorage, TypedFileStorage } from './file-storage-service';

/**
 * Service for managing application settings with validation,
 * backup/restore, and migration capabilities
 */
export class SettingsService {
  private readonly storage: TypedFileStorage<AppSettings>;
  private readonly migrationStorage: TypedFileStorage<SettingsMigration[]>;
  private readonly settingsFile = 'settings.json';
  private readonly migrationsFile = 'migrations.json';
  private cachedSettings: AppSettings | null = null;

  constructor(storagePath: string) {
    this.storage = createTypedStorage(
      path.join(storagePath, 'settings'),
      AppSettingsSchema
    );
    this.migrationStorage = createTypedStorage(
      path.join(storagePath, 'settings'),
      z.array(SettingsMigrationSchema)
    );
  }

  /**
   * Get current settings, creating defaults if none exist
   */
  async getSettings(): Promise<AppSettings> {
    // Return cached settings if available
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    let settings = await this.storage.read(this.settingsFile);

    if (!settings) {
      // Create default settings
      settings = createDefaultSettings();
      await this.storage.write(this.settingsFile, settings);
    }

    this.cachedSettings = settings;
    return settings;
  }

  /**
   * Update settings with partial data
   */
  async updateSettings(update: AppSettingsUpdate): Promise<AppSettings> {
    const current = await this.getSettings();

    // Create backup before update if enabled
    if (current.fileStorage.backupBeforeUpdate) {
      await this.createBackup();
    }

    // Merge update with current settings (deep merge for nested objects)
    const merged = {
      ...current,
      ...update,
      // Deep merge for nested objects
      ...(update.polling && {
        polling: { ...current.polling, ...update.polling },
      }),
      ...(update.fileStorage && {
        fileStorage: { ...current.fileStorage, ...update.fileStorage },
      }),
      ...(update.kometa && { kometa: { ...current.kometa, ...update.kometa } }),
      ...(update.display && {
        display: { ...current.display, ...update.display },
      }),
      lastUpdated: new Date().toISOString(),
    };

    // Validate and save
    const validated = AppSettingsSchema.parse(merged);
    await this.storage.write(this.settingsFile, validated);

    // Clear cache
    this.cachedSettings = validated;

    return validated;
  }

  /**
   * Create a backup of current settings
   */
  async createBackup(): Promise<string | null> {
    const settings = await this.getSettings();
    const maxBackups = settings.fileStorage.maxBackups;

    return this.storage.createBackup(this.settingsFile, maxBackups);
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<{ name: string; created: Date }[]> {
    const files = await this.storage.list('.', {
      prefix: 'settings-backup-',
      extension: '.json',
    });

    return files
      .map((file) => {
        // Extract timestamp from filename: settings-backup-YYYY-MM-DDTHH-MM-SS_mmmZ.json
        const match = file.match(
          /settings-backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_\d{3}Z)\.json/
        );
        if (match && match[1]) {
          // Convert filename format back to ISO: replace second and third dash with colons
          const parts = match[1].split('T');
          const datePart = parts[0];
          const timePart =
            parts[1]?.replace(/-/g, ':').replace(/_/g, '.') ?? '';
          const timestamp = `${datePart}T${timePart}`;

          return {
            name: file,
            created: new Date(timestamp),
          };
        }

        return {
          name: file,
          created: new Date(),
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  /**
   * Restore settings from a backup
   */
  async restoreFromBackup(backupName: string): Promise<AppSettings> {
    await this.storage.restoreBackup(backupName, this.settingsFile);

    // Clear cache and reload
    this.cachedSettings = null;
    return this.getSettings();
  }

  /**
   * Migrate settings to a new version
   */
  async migrateSettings(
    targetVersion: string,
    // eslint-disable-next-line no-unused-vars
    migrationFn: (_current: AppSettings) => AppSettings
  ): Promise<AppSettings> {
    const current = await this.getSettings();

    // Skip if already on target version
    if (current.version === targetVersion) {
      return current;
    }

    // Create backup before migration
    await this.createBackup();

    // Record migration
    const migrations = await this.getMigrations();
    const migration: SettingsMigration = {
      version: targetVersion,
      migratedAt: new Date().toISOString(),
      from: current.version,
      changes: [`Migrated from v${current.version} to v${targetVersion}`],
    };

    // Apply migration
    const migrated = migrationFn(current);
    migrated.version = targetVersion;
    migrated.lastUpdated = new Date().toISOString();

    // Save migrated settings
    await this.storage.write(this.settingsFile, migrated);

    // Save migration record
    migrations.push(migration);
    await this.migrationStorage.write(this.migrationsFile, migrations);

    // Clear cache
    this.cachedSettings = migrated;

    return migrated;
  }

  /**
   * Get migration history
   */
  async getMigrations(): Promise<SettingsMigration[]> {
    const migrations = await this.migrationStorage.read(this.migrationsFile);
    return migrations ?? [];
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<AppSettings> {
    // Create backup first
    await this.createBackup();

    // Create and save default settings
    const defaults = createDefaultSettings();
    await this.storage.write(this.settingsFile, defaults);

    // Clear cache
    this.cachedSettings = defaults;

    return defaults;
  }

  /**
   * Export settings as JSON string
   */
  async exportSettings(): Promise<string> {
    const settings = await this.getSettings();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from JSON string
   */
  async importSettings(jsonString: string): Promise<AppSettings> {
    // Parse and validate
    const parsed = JSON.parse(jsonString);
    const validated = AppSettingsSchema.parse(parsed);

    // Create backup before import
    await this.createBackup();

    // Save imported settings
    validated.lastUpdated = new Date().toISOString();
    await this.storage.write(this.settingsFile, validated);

    // Clear cache
    this.cachedSettings = validated;

    return validated;
  }

  /**
   * Clear settings cache
   */
  clearCache(): void {
    this.cachedSettings = null;
  }
}

// Factory function
export function createSettingsService(storagePath: string): SettingsService {
  return new SettingsService(storagePath);
}

// Example migration functions
export const settingsMigrations = {
  /**
   * Example migration from 1.0.0 to 1.1.0
   */
  '1.0.0_to_1.1.0': (settings: AppSettings): AppSettings => {
    return {
      ...settings,
      // Add new fields or transform existing ones
      display: {
        ...settings.display,
        // Example: Add new display option (matching the default from schema)
        showAdvancedOptions: settings.display?.showAdvancedOptions ?? false,
      },
    };
  },

  /**
   * Example migration from 1.1.0 to 1.2.0
   */
  '1.1.0_to_1.2.0': (settings: AppSettings): AppSettings => {
    return {
      ...settings,
      // Example: Rename or restructure fields
      kometa: {
        ...settings.kometa,
        // Example: Update docker image to new version
        dockerImage: 'meisnate12/kometa:v2.0.0',
      },
    };
  },
};
