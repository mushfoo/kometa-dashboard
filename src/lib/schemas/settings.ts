import { z } from 'zod';

export const ThemeSchema = z.enum(['light', 'dark', 'system']);

export const LogLevelSchema = z.enum(['debug', 'info', 'warning', 'error']);

export const AppSettingsSchema = z.object({
  theme: ThemeSchema.default('system'),
  pollingInterval: z.number().min(1000).max(300000).default(5000), // 1s to 5min
  logLevel: LogLevelSchema.default('info'),
  autoRefresh: z.boolean().default(true),
  maxLogLines: z.number().min(100).max(10000).default(1000),
  enableNotifications: z.boolean().default(true),
  compactMode: z.boolean().default(false),
});

export const UserPreferencesSchema = z.object({
  sidebarCollapsed: z.boolean().default(false),
  dashboardLayout: z.enum(['grid', 'list']).default('grid'),
  defaultView: z
    .enum(['dashboard', 'config', 'collections', 'logs'])
    .default('dashboard'),
  showHelpTooltips: z.boolean().default(true),
  dateFormat: z.enum(['ISO', 'US', 'EU']).default('ISO'),
  timeFormat: z.enum(['12h', '24h']).default('24h'),
});

export const SystemSettingsSchema = z.object({
  backupRetention: z.number().min(1).max(50).default(5),
  configValidationStrict: z.boolean().default(true),
  enableTelemetry: z.boolean().default(false),
  maxConcurrentOperations: z.number().min(1).max(10).default(3),
  storageCleanupInterval: z.number().min(3600).max(604800).default(86400), // 1h to 1week, default 1day
});

export const SettingsSchema = z.object({
  app: AppSettingsSchema,
  user: UserPreferencesSchema,
  system: SystemSettingsSchema,
  version: z.string().default('1.0.0'),
  lastUpdated: z.string().datetime().optional(),
});

export type Theme = z.infer<typeof ThemeSchema>;
export type LogLevel = z.infer<typeof LogLevelSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type SystemSettings = z.infer<typeof SystemSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  app: AppSettingsSchema.parse({}),
  user: UserPreferencesSchema.parse({}),
  system: SystemSettingsSchema.parse({}),
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
};
