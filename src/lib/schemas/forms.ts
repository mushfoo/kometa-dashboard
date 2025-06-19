import { z } from 'zod';

/**
 * Plex Connection Form Schema
 */
export const plexConnectionSchema = z.object({
  url: z
    .string()
    .min(1, 'Plex server URL is required')
    .url('Please enter a valid URL (e.g., http://192.168.1.100:32400)')
    .refine((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'URL must use http:// or https:// protocol'),
  token: z
    .string()
    .min(1, 'Plex token is required')
    .min(20, 'Plex token must be at least 20 characters')
    .max(32, 'Plex token cannot exceed 32 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid token format'),
  serverName: z.string().optional(),
  timeout: z
    .number()
    .min(5000, 'Timeout must be at least 5 seconds')
    .max(60000, 'Timeout cannot exceed 60 seconds')
    .default(30000),
});

export type PlexConnectionForm = z.infer<typeof plexConnectionSchema>;

// Alias for backward compatibility
export const plexConnectionFormSchema = plexConnectionSchema;

/**
 * Plex Configuration Form Schema with Library Selection
 */
export const plexConfigFormSchema = plexConnectionSchema.extend({
  selectedLibraries: z.array(z.string()).optional(),
  connectionStatus: z
    .enum(['connected', 'disconnected', 'testing', 'error'])
    .optional(),
  availableLibraries: z
    .array(
      z.object({
        key: z.string(),
        title: z.string(),
        type: z.string(),
        updatedAt: z.number().optional(),
      })
    )
    .optional(),
});

export type PlexConfigForm = z.infer<typeof plexConfigFormSchema>;

/**
 * API Keys Management Form Schema
 */
export const apiKeysSchema = z.object({
  tmdb: z
    .string()
    .refine(
      (val) => val === '' || /^[a-f0-9]{32}$/.test(val),
      'TMDb API key must be 32 hexadecimal characters'
    )
    .optional(),
  trakt: z
    .object({
      clientId: z
        .string()
        .refine(
          (val) => val === '' || (val.length === 64 && /^[a-f0-9]+$/.test(val)),
          'Trakt Client ID must be 64 hexadecimal characters'
        )
        .optional(),
      clientSecret: z
        .string()
        .refine(
          (val) => val === '' || (val.length === 64 && /^[a-f0-9]+$/.test(val)),
          'Trakt Client Secret must be 64 hexadecimal characters'
        )
        .optional(),
    })
    .optional(),
  imdb: z
    .string()
    .refine(
      (val) => val === '' || /^ur\d+$/.test(val),
      'IMDb user ID must start with "ur" followed by numbers'
    )
    .optional(),
  anidb: z
    .string()
    .refine(
      (val) => val === '' || /^[a-zA-Z0-9]{32}$/.test(val),
      'AniDB API key must be 32 alphanumeric characters'
    )
    .optional(),
});

export type ApiKeysForm = z.infer<typeof apiKeysSchema>;

// Updated schema with correct field names for Day 11 implementation
export const apiKeysFormSchema = z.object({
  tmdb: z.string().optional(),
  trakt: z
    .object({
      client_id: z.string().optional(),
      client_secret: z.string().optional(),
      pin: z.string().optional(),
    })
    .optional(),
  imdb: z.string().optional(),
  anidb: z
    .object({
      client: z.string().optional(),
      version: z.string().optional(),
      language: z.string().optional(),
    })
    .optional(),
});

export type ApiKeysFormSchema = z.infer<typeof apiKeysFormSchema>;

/**
 * Library Settings Form Schema
 */
export const librarySettingsSchema = z.object({
  libraries: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['movie', 'show', 'artist']),
      enabled: z.boolean().default(true),
      scanInterval: z
        .number()
        .min(1, 'Scan interval must be at least 1 hour')
        .max(168, 'Scan interval cannot exceed 1 week (168 hours)')
        .default(24),
      collectionsEnabled: z.boolean().default(true),
      overlaysEnabled: z.boolean().default(false),
      metadataUpdates: z.boolean().default(true),
    })
  ),
  globalSettings: z.object({
    runTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format')
      .default('06:00'),
    timezone: z.string().default('UTC'),
    deleteCollections: z.boolean().default(false),
    minimumItems: z
      .number()
      .min(0, 'Minimum items cannot be negative')
      .max(1000, 'Minimum items cannot exceed 1000')
      .default(2),
  }),
});

export type LibrarySettingsForm = z.infer<typeof librarySettingsSchema>;

/**
 * Complete Configuration Schema for Dual-Pane Editor
 * Combines all configuration sections into a single schema
 */
export const dualPaneConfigSchema = z.object({
  plex: z
    .object({
      url: z.string().optional(),
      token: z.string().optional(),
      serverName: z.string().optional(),
      timeout: z.number().optional(),
      selectedLibraries: z.array(z.string()).optional(),
      connectionStatus: z
        .enum(['connected', 'disconnected', 'testing', 'error'])
        .optional(),
      availableLibraries: z
        .array(
          z.object({
            key: z.string(),
            title: z.string(),
            type: z.string(),
            updatedAt: z.number().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  tmdb: z.string().optional(),
  trakt: z
    .object({
      client_id: z.string().optional(),
      client_secret: z.string().optional(),
      pin: z.string().optional(),
    })
    .optional(),
  imdb: z.string().optional(),
  anidb: z
    .object({
      client: z.string().optional(),
      version: z.string().optional(),
      language: z.string().optional(),
    })
    .optional(),
  libraries: z.record(z.string(), z.any()).optional(),
  settings: z
    .object({
      run_order: z.array(z.string()).optional(),
      cache_expiration: z.number().optional(),
      asset_directory: z.array(z.string()).optional(),
      asset_folders: z.boolean().optional(),
      asset_depth: z.number().optional(),
      create_asset_folders: z.boolean().optional(),
      prioritize_assets: z.boolean().optional(),
      download_url_assets: z.boolean().optional(),
      show_missing_season_assets: z.boolean().optional(),
      show_missing_episode_assets: z.boolean().optional(),
      show_asset_not_needed: z.boolean().optional(),
      sync_mode: z.enum(['append', 'sync']).optional(),
      minimum_items: z.number().optional(),
      delete_below_minimum: z.boolean().optional(),
      delete_not_scheduled: z.boolean().optional(),
      run_again_delay: z.number().optional(),
      missing_only_released: z.boolean().optional(),
      only_filter_missing: z.boolean().optional(),
      show_unmanaged: z.boolean().optional(),
      show_filtered: z.boolean().optional(),
      show_options: z.boolean().optional(),
      show_missing: z.boolean().optional(),
      save_report: z.boolean().optional(),
      tvdb_language: z.string().optional(),
      ignore_ids: z.array(z.number()).optional(),
      ignore_imdb_ids: z.array(z.string()).optional(),
      playlist_sync_to_user: z.array(z.string()).optional(),
      playlist_exclude_users: z.array(z.string()).optional(),
    })
    .optional(),
  webhooks: z
    .object({
      error: z.string().optional(),
      version: z.string().optional(),
      run_start: z.string().optional(),
      run_end: z.string().optional(),
      changes: z.string().optional(),
    })
    .optional(),
});

export type DualPaneConfigForm = z.infer<typeof dualPaneConfigSchema>;

// Updated schema for Day 11 library settings implementation
export const librarySettingsFormSchema = z.object({
  libraries: z.array(
    z.object({
      library_name: z.string(),
      type: z.enum(['movie', 'show', 'music']),
      operations: z.object({
        assets_for_all: z.boolean(),
        delete_collections: z.boolean(),
        mass_critic_rating_update: z.boolean(),
        split_duplicates: z.boolean(),
      }),
      scan_interval: z.number().optional(),
      scanner_threads: z.number().optional(),
      collection_refresh_interval: z.number().optional(),
      delete_unmanaged_collections: z.boolean().optional(),
      delete_unmanaged_assets: z.boolean().optional(),
    })
  ),
  settings: z.object({
    scan_interval: z.number().min(1).max(168).default(24),
    scanner_threads: z.number().min(1).max(10).default(2),
    collection_refresh_interval: z.number().min(1).max(720).default(168),
    delete_unmanaged_collections: z.boolean().default(false),
    delete_unmanaged_assets: z.boolean().default(false),
  }),
});

export type LibrarySettingsFormSchema = z.infer<
  typeof librarySettingsFormSchema
>;

/**
 * Collection Builder Form Schema
 */
export const collectionBuilderSchema = z.object({
  name: z
    .string()
    .min(1, 'Collection name is required')
    .max(100, 'Collection name cannot exceed 100 characters')
    .regex(
      /^[a-zA-Z0-9\s\-_()]+$/,
      'Collection name contains invalid characters'
    ),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
  type: z.enum(['smart', 'manual'], {
    required_error: 'Collection type is required',
  }),
  poster: z
    .string()
    .url('Poster must be a valid URL')
    .optional()
    .or(z.literal('')),
  sortOrder: z
    .enum(['release.desc', 'release.asc', 'alpha.asc', 'alpha.desc', 'random'])
    .default('release.desc'),
  visibility: z.enum(['visible', 'hidden']).default('visible'),
  minimumItems: z
    .number()
    .min(0, 'Minimum items cannot be negative')
    .max(1000, 'Minimum items cannot exceed 1000')
    .default(1),
  filters: z
    .object({
      genres: z.array(z.string()).optional(),
      years: z
        .object({
          min: z.number().min(1900).max(2100).optional(),
          max: z.number().min(1900).max(2100).optional(),
        })
        .optional(),
      ratings: z
        .object({
          min: z.number().min(0).max(10).optional(),
          max: z.number().min(0).max(10).optional(),
        })
        .optional(),
      actors: z.array(z.string()).optional(),
      directors: z.array(z.string()).optional(),
      studios: z.array(z.string()).optional(),
    })
    .optional(),
});

export type CollectionBuilderForm = z.infer<typeof collectionBuilderSchema>;

/**
 * System Settings Form Schema
 */
export const systemSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.enum(['en', 'es', 'fr', 'de', 'it']).default('en'),
  dateFormat: z
    .enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'])
    .default('MM/DD/YYYY'),
  timeFormat: z.enum(['12h', '24h']).default('12h'),
  timezone: z.string().default('UTC'),
  notifications: z
    .object({
      enabled: z.boolean().default(true),
      operationComplete: z.boolean().default(true),
      operationFailed: z.boolean().default(true),
      systemAlerts: z.boolean().default(true),
      weeklyReports: z.boolean().default(false),
    })
    .default({}),
  advanced: z
    .object({
      logLevel: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR']).default('INFO'),
      maxLogFiles: z
        .number()
        .min(1, 'Must keep at least 1 log file')
        .max(30, 'Cannot keep more than 30 log files')
        .default(7),
      cacheSize: z
        .number()
        .min(100, 'Cache size must be at least 100MB')
        .max(2000, 'Cache size cannot exceed 2GB')
        .default(500),
      concurrentOperations: z
        .number()
        .min(1, 'Must allow at least 1 concurrent operation')
        .max(10, 'Cannot exceed 10 concurrent operations')
        .default(2),
    })
    .default({}),
});

export type SystemSettingsForm = z.infer<typeof systemSettingsSchema>;

/**
 * Operation Parameters Form Schema
 */
export const operationParametersSchema = z.object({
  libraries: z
    .array(z.string())
    .min(1, 'At least one library must be selected'),
  operations: z
    .object({
      metadata: z.boolean().default(true),
      collections: z.boolean().default(true),
      overlays: z.boolean().default(false),
      operations: z.boolean().default(false),
    })
    .default({}),
  options: z
    .object({
      runImmediately: z.boolean().default(false),
      ignoreSchedule: z.boolean().default(false),
      dryRun: z.boolean().default(false),
      verboseLogging: z.boolean().default(false),
    })
    .default({}),
  schedule: z
    .object({
      enabled: z.boolean().default(false),
      time: z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format')
        .optional(),
      days: z
        .array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']))
        .optional(),
    })
    .optional(),
});

export type OperationParametersForm = z.infer<typeof operationParametersSchema>;

/**
 * Form validation utilities
 */
export const formValidationUtils = {
  /**
   * Validate if two passwords match
   */
  passwordMatch: (password: string, confirmPassword: string) =>
    password === confirmPassword || 'Passwords do not match',

  /**
   * Validate URL accessibility
   */
  urlAccessible: async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Validate date range
   */
  dateRange: (startDate: Date, endDate: Date) =>
    startDate <= endDate || 'Start date must be before end date',

  /**
   * Sanitize string input
   */
  sanitizeString: (input: string): string =>
    input.trim().replace(/[<>"'&]/g, ''),
};
