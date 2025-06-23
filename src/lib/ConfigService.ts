import { promises as fs } from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { FileStorageService } from './file-storage-service';

// Kometa configuration schema
const KometaConfigSchema = z.object({
  plex: z.object({
    url: z.string().url(),
    token: z.string().min(1),
    timeout: z.number().nullable().optional(),
    library_types: z.array(z.string()).nullable().optional(),
    db_cache: z.any().nullable().optional(),
    clean_bundles: z.boolean().nullable().optional(),
    empty_trash: z.boolean().nullable().optional(),
    optimize: z.boolean().nullable().optional(),
    verify_ssl: z.boolean().nullable().optional(),
  }),
  tmdb: z
    .object({
      apikey: z.string().min(1),
      language: z.string().nullable().optional(),
      region: z.string().nullable().optional(),
    })
    .optional(),
  trakt: z
    .object({
      client_id: z.string().min(1),
      client_secret: z.string().min(1),
      authorization: z
        .object({
          access_token: z.string().min(1),
          token_type: z.string().nullable().optional(),
          expires_in: z.number().nullable().optional(),
          refresh_token: z.string().nullable().optional(),
          scope: z.string().nullable().optional(),
        })
        .optional(),
      pin: z.string().nullable().optional(),
    })
    .optional(),
  imdb: z
    .object({
      apikey: z.string().min(1),
    })
    .optional(),
  radarr: z.any().optional(),
  sonarr: z.any().optional(),
  libraries: z.record(z.string(), z.any()).optional(),
  settings: z
    .object({
      run_again_delay: z.number().nullable().optional(),
      asset_directory: z
        .union([z.string(), z.array(z.string())])
        .nullable()
        .optional(),
      sync_mode: z.enum(['append', 'sync']).nullable().optional(),
      delete_below_minimum: z.boolean().nullable().optional(),
      create_asset_folders: z.boolean().nullable().optional(),
      playlist_sync_to_user: z.boolean().nullable().optional(),
    })
    .passthrough() // Allow additional properties that aren't defined
    .optional(),
  webhooks: z.record(z.string(), z.any()).optional(),
  playlist_files: z.array(z.any()).optional(),
  metadata_files: z.array(z.any()).optional(),
  collection_files: z.array(z.any()).optional(),
  overlay_files: z.array(z.any()).optional(),
});

export type KometaConfig = z.infer<typeof KometaConfigSchema>;

export class ConfigService {
  private readonly storage: FileStorageService;
  private readonly configPath: string;

  constructor(basePath: string = './storage') {
    this.storage = new FileStorageService(basePath);
    this.configPath = 'config.yml';
  }

  /**
   * Read the Kometa configuration file
   */
  async getConfig(): Promise<KometaConfig | null> {
    try {
      // Read the raw file content
      const rawContent = await this.readRawYaml();
      if (!rawContent) {
        return null;
      }

      // Parse YAML
      const parsed = yaml.load(rawContent) as unknown;

      // Validate against schema
      const config = KometaConfigSchema.parse(parsed);
      return config;
    } catch (error) {
      throw new Error(`Failed to read configuration: ${error}`);
    }
  }

  /**
   * Update the Kometa configuration file
   */
  async updateConfig(config: KometaConfig): Promise<void> {
    try {
      // Validate the configuration
      const validatedConfig = KometaConfigSchema.parse(config);

      // Create backup before updating
      await this.createBackup();

      // Convert to YAML and write
      const yamlContent = yaml.dump(validatedConfig, {
        indent: 2,
        lineWidth: 120,
        quotingType: '"',
        forceQuotes: false,
      });

      await this.writeRawYaml(yamlContent);
    } catch (error) {
      throw new Error(`Failed to update configuration: ${error}`);
    }
  }

  /**
   * Validate a configuration object without saving
   */
  async validateConfig(config: unknown): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      // Basic schema validation
      KometaConfigSchema.parse(config);

      // Additional Kometa-specific validation
      const warnings: string[] = [];
      const errors: string[] = [];

      const parsedConfig = config as KometaConfig;

      // Check for required fields
      if (!parsedConfig.plex) {
        errors.push('Plex configuration is required');
      }

      // Warn about missing recommended fields
      if (!parsedConfig.tmdb && !parsedConfig.trakt) {
        warnings.push('No metadata provider (TMDb or Trakt) configured');
      }

      if (!parsedConfig.libraries) {
        warnings.push('No libraries configured');
      }

      const result: {
        valid: boolean;
        errors?: string[];
        warnings?: string[];
      } = {
        valid: errors.length === 0,
      };

      if (errors.length > 0) {
        result.errors = errors;
      }

      if (warnings.length > 0) {
        result.warnings = warnings;
      }

      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const result: {
          valid: boolean;
          errors?: string[];
          warnings?: string[];
        } = {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
        return result;
      }

      const result: {
        valid: boolean;
        errors?: string[];
        warnings?: string[];
      } = {
        valid: false,
        errors: [`Validation error: ${error}`],
      };
      return result;
    }
  }

  /**
   * Create a backup of the current configuration
   */
  async createBackup(): Promise<string | null> {
    if (!(await this.storage.exists(this.configPath))) {
      return null;
    }

    return await this.storage.createBackup(this.configPath, 5);
  }

  /**
   * List available configuration backups
   */
  async listBackups(): Promise<string[]> {
    try {
      const files = await this.storage.list('/', {
        prefix: 'config-backup-',
        extension: '.yml',
      });
      return files.sort().reverse(); // Most recent first
    } catch {
      return [];
    }
  }

  /**
   * Restore configuration from backup
   */
  async restoreBackup(backupFilename: string): Promise<void> {
    await this.storage.restoreBackup(backupFilename, this.configPath);
  }

  /**
   * Get configuration file status
   */
  async getConfigStatus(): Promise<{
    exists: boolean;
    size?: number;
    lastModified?: Date;
    backupCount: number;
  }> {
    const backups = await this.listBackups();

    const result: {
      exists: boolean;
      size?: number;
      lastModified?: Date;
      backupCount: number;
    } = {
      exists: false,
      backupCount: backups.length,
    };

    try {
      const filePath = path.join(
        (this.storage as any).basePath,
        this.configPath
      );
      const stats = await fs.stat(filePath);
      result.exists = true;
      result.size = stats.size;
      result.lastModified = stats.mtime;
    } catch (error) {
      // File doesn't exist or can't be accessed
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Error accessing config file:', error);
      }
    }

    return result;
  }

  /**
   * Read raw YAML content without parsing
   */
  private async readRawYaml(): Promise<string | null> {
    try {
      const filePath = path.join(this.storage['basePath'], this.configPath);
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write raw YAML content
   */
  private async writeRawYaml(content: string): Promise<void> {
    const filePath = path.join(this.storage['basePath'], this.configPath);
    const tempPath = `${filePath}.tmp`;

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write to temp file
      await fs.writeFile(tempPath, content, 'utf-8');

      // Atomic rename
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}

// Export convenience function
export function createConfigService(basePath?: string): ConfigService {
  return new ConfigService(basePath);
}
