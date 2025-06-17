import { z } from 'zod';

/**
 * Application settings schema with default values
 */

// Theme options
export const ThemeSchema = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

// Log level options
export const LogLevelSchema = z.enum(['debug', 'info', 'warning', 'error']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

// Polling intervals (in milliseconds)
export const PollingIntervalsSchema = z.object({
  status: z.number().min(1000).max(60000), // 5 seconds default
  logs: z.number().min(500).max(30000), // 2 seconds default
  operations: z.number().min(1000).max(60000), // 3 seconds default
});
export type PollingIntervals = z.infer<typeof PollingIntervalsSchema>;

// File storage settings
export const FileStorageSettingsSchema = z.object({
  maxBackups: z.number().min(1).max(20),
  autoBackup: z.boolean(),
  backupBeforeUpdate: z.boolean(),
});
export type FileStorageSettings = z.infer<typeof FileStorageSettingsSchema>;

// Kometa process settings
export const KometaSettingsSchema = z.object({
  executable: z.string(),
  configPath: z.string(),
  useDocker: z.boolean(),
  dockerImage: z.string(),
  timeout: z.number().min(60000).max(3600000), // 30 minutes default
});
export type KometaSettings = z.infer<typeof KometaSettingsSchema>;

// Display preferences
export const DisplaySettingsSchema = z.object({
  dateFormat: z.string(),
  timezone: z.string(),
  itemsPerPage: z.number().min(10).max(100),
  showAdvancedOptions: z.boolean(),
  collapseSidebar: z.boolean(),
});
export type DisplaySettings = z.infer<typeof DisplaySettingsSchema>;

// Main application settings schema
export const AppSettingsSchema = z.object({
  version: z.string(),
  theme: ThemeSchema,
  logLevel: LogLevelSchema,
  polling: PollingIntervalsSchema,
  fileStorage: FileStorageSettingsSchema,
  kometa: KometaSettingsSchema,
  display: DisplaySettingsSchema,
  lastUpdated: z.string().datetime().optional(),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

// Default settings factory
export function createDefaultSettings(): AppSettings {
  const defaults = {
    version: '1.0.0',
    theme: 'system' as const,
    logLevel: 'info' as const,
    polling: {
      status: 5000,
      logs: 2000,
      operations: 3000,
    },
    fileStorage: {
      maxBackups: 5,
      autoBackup: true,
      backupBeforeUpdate: true,
    },
    kometa: {
      executable: 'kometa',
      configPath: './config.yml',
      useDocker: false,
      dockerImage: 'meisnate12/kometa:latest',
      timeout: 1800000,
    },
    display: {
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      timezone: 'local',
      itemsPerPage: 25,
      showAdvancedOptions: false,
      collapseSidebar: false,
    },
  };
  return AppSettingsSchema.parse(defaults);
}

// Settings update schema (partial, for patches)
export const AppSettingsUpdateSchema = AppSettingsSchema.partial();
export type AppSettingsUpdate = z.infer<typeof AppSettingsUpdateSchema>;

// Migration version schema
export const SettingsMigrationSchema = z.object({
  version: z.string(),
  migratedAt: z.string().datetime(),
  from: z.string().optional(),
  changes: z.array(z.string()).optional(),
});
export type SettingsMigration = z.infer<typeof SettingsMigrationSchema>;
