import { ConfigService, KometaConfig } from './ConfigService';
import { promises as fs } from 'fs';
import path from 'path';
// import * as yaml from 'js-yaml';
// import { z } from 'zod';

// Configuration template interface
export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'advanced' | 'specialized';
  config: Partial<KometaConfig>;
  variables?: Record<string, {
    description: string;
    type: 'string' | 'number' | 'boolean';
    default?: unknown;
    required?: boolean;
  }>;
}

// Template variables for substitution
export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

// Extended validation result
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
}

/**
 * ConfigManager extends ConfigService with advanced configuration management features
 * including templates, enhanced validation, and configuration assistance.
 */
export class ConfigManager extends ConfigService {
  private templatesCache: Map<string, ConfigTemplate> = new Map();
  private readonly templatesPath: string;

  constructor(basePath: string = './storage') {
    super(basePath);
    this.templatesPath = path.join(basePath, 'templates');
  }

  /**
   * Enhanced configuration validation with detailed feedback
   */
  async validateConfigAdvanced(config: unknown): Promise<ValidationResult> {
    const baseResult = await this.validateConfig(config);
    
    const result: ValidationResult = {
      valid: baseResult.valid,
      errors: baseResult.errors || [],
      warnings: baseResult.warnings || [],
      suggestions: [],
    };

    if (!baseResult.valid) {
      return result;
    }

    const parsedConfig = config as KometaConfig;

    // Advanced validation and suggestions
    await this.addPerformanceSuggestions(parsedConfig, result);
    await this.addSecuritySuggestions(parsedConfig, result);
    await this.addBestPracticeSuggestions(parsedConfig, result);

    return result;
  }

  /**
   * Create configuration from template with variable substitution
   */
  async createFromTemplate(
    templateId: string, 
    variables: TemplateVariables = {}
  ): Promise<KometaConfig> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    if (template.variables) {
      for (const [key, variable] of Object.entries(template.variables)) {
        if (variable.required && !(key in variables)) {
          throw new Error(`Required variable missing: ${key}`);
        }
      }
    }

    // Perform variable substitution
    const configWithVariables = this.substituteVariables(
      template.config, 
      variables, 
      template.variables || {}
    );

    // Validate the resulting configuration
    const validation = await this.validateConfigAdvanced(configWithVariables);
    if (!validation.valid) {
      throw new Error(`Template configuration is invalid: ${validation.errors?.join(', ')}`);
    }

    return configWithVariables as KometaConfig;
  }

  /**
   * Get all available templates
   */
  async getTemplates(): Promise<ConfigTemplate[]> {
    // Load built-in templates
    const builtInTemplates = await this.loadBuiltInTemplates();
    
    // Load custom templates from storage
    const customTemplates = await this.loadCustomTemplates();

    return [...builtInTemplates, ...customTemplates];
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(templateId: string): Promise<ConfigTemplate | null> {
    if (this.templatesCache.has(templateId)) {
      return this.templatesCache.get(templateId)!;
    }

    const templates = await this.getTemplates();
    const template = templates.find(t => t.id === templateId);
    
    if (template) {
      this.templatesCache.set(templateId, template);
    }

    return template || null;
  }

  /**
   * Save a custom template
   */
  async saveTemplate(template: ConfigTemplate): Promise<void> {
    // Ensure templates directory exists
    await fs.mkdir(this.templatesPath, { recursive: true });

    const templatePath = path.join(this.templatesPath, `${template.id}.json`);
    
    // Validate template structure
    this.validateTemplateStructure(template);

    // Write template file atomically
    const tempPath = `${templatePath}.tmp`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(template, null, 2), 'utf-8');
      await fs.rename(tempPath, templatePath);
      
      // Update cache
      this.templatesCache.set(template.id, template);
    } catch (error) {
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Delete a custom template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    const templatePath = path.join(this.templatesPath, `${templateId}.json`);
    
    try {
      await fs.unlink(templatePath);
      this.templatesCache.delete(templateId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate configuration suggestions based on current setup
   */
  async generateSuggestions(currentConfig?: KometaConfig): Promise<{
    templates: ConfigTemplate[];
    improvements: string[];
    missingFeatures: string[];
  }> {
    const templates = await this.getTemplates();
    const suggestions = {
      templates: [] as ConfigTemplate[],
      improvements: [] as string[],
      missingFeatures: [] as string[],
    };

    if (!currentConfig) {
      // Suggest basic templates for new users
      suggestions.templates = templates.filter(t => t.category === 'basic');
      suggestions.missingFeatures = [
        'Plex server connection',
        'Metadata provider (TMDb/Trakt)',
        'Library configuration',
        'Collection definitions',
      ];
      return suggestions;
    }

    // Analyze current configuration and suggest improvements
    if (!currentConfig.tmdb && !currentConfig.trakt) {
      suggestions.improvements.push('Add a metadata provider (TMDb or Trakt) for enhanced collection features');
      suggestions.templates.push(...templates.filter(t => 
        t.name.toLowerCase().includes('tmdb') || t.name.toLowerCase().includes('trakt')
      ));
    }

    if (!currentConfig.libraries || Object.keys(currentConfig.libraries).length === 0) {
      suggestions.improvements.push('Configure library-specific settings for better organization');
    }

    if (!currentConfig.settings?.asset_directory) {
      suggestions.improvements.push('Configure asset directories for custom posters and artwork');
    }

    if (!currentConfig.webhooks) {
      suggestions.missingFeatures.push('Webhook notifications for operation status');
    }

    return suggestions;
  }

  /**
   * Migrate configuration to newer format/version
   */
  async migrateConfig(config: unknown): Promise<KometaConfig> {
    // Basic migration logic - can be expanded as needed
    const migratedConfig = { ...config } as any;

    // Example migration: rename old field names
    if (migratedConfig.plex?.server_url) {
      migratedConfig.plex.url = migratedConfig.plex.server_url;
      delete migratedConfig.plex.server_url;
    }

    // Validate migrated configuration
    const validation = await this.validateConfigAdvanced(migratedConfig);
    if (!validation.valid) {
      throw new Error(`Migration failed: ${validation.errors?.join(', ')}`);
    }

    return migratedConfig as KometaConfig;
  }

  /**
   * Load built-in configuration templates
   */
  private async loadBuiltInTemplates(): Promise<ConfigTemplate[]> {
    return [
      {
        id: 'basic-plex-tmdb',
        name: 'Basic Plex + TMDb Setup',
        description: 'Simple configuration with Plex server and TMDb metadata provider',
        category: 'basic',
        config: {
          plex: {
            url: '${PLEX_URL}',
            token: '${PLEX_TOKEN}',
            timeout: 60,
          },
          tmdb: {
            apikey: '${TMDB_API_KEY}',
            language: 'en',
          },
          settings: {
            run_again_delay: 12,
            sync_mode: 'append',
            delete_below_minimum: true,
            create_asset_folders: true,
          },
        },
        variables: {
          PLEX_URL: {
            description: 'Plex server URL (e.g., http://localhost:32400)',
            type: 'string',
            required: true,
          },
          PLEX_TOKEN: {
            description: 'Plex authentication token',
            type: 'string',
            required: true,
          },
          TMDB_API_KEY: {
            description: 'TMDb API key for metadata',
            type: 'string',
            required: true,
          },
        },
      },
      {
        id: 'advanced-multi-provider',
        name: 'Advanced Multi-Provider Setup',
        description: 'Comprehensive configuration with multiple metadata providers and advanced features',
        category: 'advanced',
        config: {
          plex: {
            url: '${PLEX_URL}',
            token: '${PLEX_TOKEN}',
            timeout: 60,
            library_types: ['movie', 'show'],
          },
          tmdb: {
            apikey: '${TMDB_API_KEY}',
            language: 'en',
            region: 'US',
          },
          trakt: {
            client_id: '${TRAKT_CLIENT_ID}',
            client_secret: '${TRAKT_CLIENT_SECRET}',
          },
          settings: {
            run_again_delay: 6,
            sync_mode: 'sync',
            delete_below_minimum: false,
            create_asset_folders: true,
            asset_directory: ['assets'],
          },
          webhooks: {
            discord: '${DISCORD_WEBHOOK_URL}',
          },
        },
        variables: {
          PLEX_URL: {
            description: 'Plex server URL',
            type: 'string',
            required: true,
          },
          PLEX_TOKEN: {
            description: 'Plex authentication token',
            type: 'string',
            required: true,
          },
          TMDB_API_KEY: {
            description: 'TMDb API key',
            type: 'string',
            required: true,
          },
          TRAKT_CLIENT_ID: {
            description: 'Trakt client ID',
            type: 'string',
            required: false,
          },
          TRAKT_CLIENT_SECRET: {
            description: 'Trakt client secret',
            type: 'string',
            required: false,
          },
          DISCORD_WEBHOOK_URL: {
            description: 'Discord webhook URL for notifications',
            type: 'string',
            required: false,
          },
        },
      },
      {
        id: 'anime-specialized',
        name: 'Anime Collection Setup',
        description: 'Specialized configuration for anime libraries with AniDB integration',
        category: 'specialized',
        config: {
          plex: {
            url: '${PLEX_URL}',
            token: '${PLEX_TOKEN}',
            timeout: 60,
          },
          tmdb: {
            apikey: '${TMDB_API_KEY}',
            language: 'en',
          },
          settings: {
            run_again_delay: 24,
            sync_mode: 'append',
            delete_below_minimum: true,
            create_asset_folders: true,
          },
          libraries: {
            Anime: {
              collection_files: [
                'https://raw.githubusercontent.com/meisnate12/Plex-Meta-Manager-Configs/master/Default/Collections/anime.yml',
              ],
            },
          },
        },
        variables: {
          PLEX_URL: {
            description: 'Plex server URL',
            type: 'string',
            required: true,
          },
          PLEX_TOKEN: {
            description: 'Plex authentication token',
            type: 'string',
            required: true,
          },
          TMDB_API_KEY: {
            description: 'TMDb API key',
            type: 'string',
            required: true,
          },
        },
      },
    ];
  }

  /**
   * Load custom templates from storage
   */
  private async loadCustomTemplates(): Promise<ConfigTemplate[]> {
    try {
      const files = await fs.readdir(this.templatesPath);
      const templateFiles = files.filter(file => file.endsWith('.json'));
      
      const templates: ConfigTemplate[] = [];
      
      for (const file of templateFiles) {
        try {
          const filePath = path.join(this.templatesPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const template = JSON.parse(content) as ConfigTemplate;
          
          this.validateTemplateStructure(template);
          templates.push(template);
        } catch (error) {
          console.warn(`Failed to load template ${file}:`, error);
        }
      }
      
      return templates;
    } catch {
      return [];
    }
  }

  /**
   * Substitute variables in configuration template
   */
  private substituteVariables(
    config: Partial<KometaConfig>,
    variables: TemplateVariables,
    templateVariables: ConfigTemplate['variables'] = {}
  ): Partial<KometaConfig> {
    const configStr = JSON.stringify(config);
    
    // Substitute variables with format ${VARIABLE_NAME}
    let substitutedStr = configStr;
    
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`"\\$\\{${key}\\}"`, 'g');
      const quotedPattern = new RegExp(`\\$\\{${key}\\}`, 'g');
      
      // Handle both quoted and unquoted substitutions
      if (typeof value === 'string') {
        substitutedStr = substitutedStr.replace(pattern, JSON.stringify(value));
        substitutedStr = substitutedStr.replace(quotedPattern, String(value));
      } else {
        // For numbers and booleans, replace without quotes
        substitutedStr = substitutedStr.replace(pattern, String(value));
        substitutedStr = substitutedStr.replace(quotedPattern, String(value));
      }
    }

    // Apply default values for missing variables
    for (const [key, variable] of Object.entries(templateVariables)) {
      if (!(key in variables) && variable.default !== undefined) {
        const pattern = new RegExp(`"\\$\\{${key}\\}"`, 'g');
        const quotedPattern = new RegExp(`\\$\\{${key}\\}`, 'g');
        
        if (typeof variable.default === 'string') {
          substitutedStr = substitutedStr.replace(pattern, JSON.stringify(variable.default));
          substitutedStr = substitutedStr.replace(quotedPattern, String(variable.default));
        } else {
          // For numbers and booleans, replace without quotes
          substitutedStr = substitutedStr.replace(pattern, String(variable.default));
          substitutedStr = substitutedStr.replace(quotedPattern, String(variable.default));
        }
      }
    }

    return JSON.parse(substitutedStr);
  }

  /**
   * Validate template structure
   */
  private validateTemplateStructure(template: ConfigTemplate): void {
    const requiredFields = ['id', 'name', 'description', 'category', 'config'];
    for (const field of requiredFields) {
      if (!(field in template)) {
        throw new Error(`Template missing required field: ${field}`);
      }
    }

    if (!['basic', 'advanced', 'specialized'].includes(template.category)) {
      throw new Error(`Invalid template category: ${template.category}`);
    }
  }

  /**
   * Add performance-related suggestions
   */
  private async addPerformanceSuggestions(
    config: KometaConfig, 
    result: ValidationResult
  ): Promise<void> {
    if (config.settings?.run_again_delay && config.settings.run_again_delay < 6) {
      result.suggestions?.push('Consider increasing run_again_delay to 6+ hours to reduce server load');
    }

    if (config.settings?.sync_mode === 'sync' && !config.settings?.delete_below_minimum) {
      result.warnings?.push('Using sync mode without delete_below_minimum can remove items unexpectedly');
    }
  }

  /**
   * Add security-related suggestions
   */
  private async addSecuritySuggestions(
    config: KometaConfig, 
    result: ValidationResult
  ): Promise<void> {
    if (config.plex?.url?.startsWith('http://') && !config.plex.url.includes('localhost')) {
      result.warnings?.push('Consider using HTTPS for Plex connections over networks');
    }

    // Check for exposed tokens in webhook URLs
    if (config.webhooks) {
      for (const [service, url] of Object.entries(config.webhooks)) {
        if (typeof url === 'string' && url.includes('token=')) {
          result.suggestions?.push(`Consider using environment variables for ${service} webhook tokens`);
        }
      }
    }
  }

  /**
   * Add best practice suggestions
   */
  private async addBestPracticeSuggestions(
    config: KometaConfig, 
    result: ValidationResult
  ): Promise<void> {
    if (!config.settings?.asset_directory) {
      result.suggestions?.push('Configure asset_directory to enable custom posters and artwork');
    }

    if (!config.libraries || Object.keys(config.libraries).length === 0) {
      result.suggestions?.push('Configure library-specific settings for better organization');
    }

    if (!config.collection_files && !config.metadata_files) {
      result.suggestions?.push('Add collection or metadata files to enhance your libraries');
    }
  }
}