// Use localStorage for browser compatibility
class BrowserStorageService {
  async read<T>(path: string): Promise<T | null> {
    try {
      const data = localStorage.getItem(path);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async write<T>(path: string, data: T): Promise<void> {
    localStorage.setItem(path, JSON.stringify(data));
  }
}
import yaml from 'yaml';

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'advanced' | 'custom';
  tags: string[];
  author?: string;
  version: string;
  created: string;
  updated: string;
  yaml: string;
  preview?: {
    collections?: number;
    libraries?: string[];
    features?: string[];
  };
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  templates: ConfigTemplate[];
}

export class TemplateService {
  private storage: BrowserStorageService;
  private readonly templatesPath = 'templates/config-templates.json';
  private readonly customTemplatesPath = 'templates/custom-templates.json';

  constructor() {
    this.storage = new BrowserStorageService();
  }

  /**
   * Get all available templates organized by category
   */
  async getAllTemplates(): Promise<TemplateCategory[]> {
    const [builtInTemplates, customTemplates] = await Promise.all([
      this.getBuiltInTemplates(),
      this.getCustomTemplates(),
    ]);

    return [
      {
        id: 'basic',
        name: 'Basic Templates',
        description: 'Simple configurations to get started quickly',
        templates: builtInTemplates.filter((t) => t.category === 'basic'),
      },
      {
        id: 'advanced',
        name: 'Advanced Templates',
        description: 'Complex configurations for power users',
        templates: builtInTemplates.filter((t) => t.category === 'advanced'),
      },
      {
        id: 'custom',
        name: 'Custom Templates',
        description: 'Your saved configuration templates',
        templates: customTemplates,
      },
    ];
  }

  /**
   * Get built-in templates
   */
  private async getBuiltInTemplates(): Promise<ConfigTemplate[]> {
    try {
      const templates = await this.storage.read<ConfigTemplate[]>(
        this.templatesPath
      );
      return templates || this.getDefaultTemplates();
    } catch {
      // Initialize with default templates if file doesn't exist
      const defaultTemplates = this.getDefaultTemplates();
      await this.storage.write(this.templatesPath, defaultTemplates);
      return defaultTemplates;
    }
  }

  /**
   * Get custom user templates
   */
  private async getCustomTemplates(): Promise<ConfigTemplate[]> {
    try {
      return (
        (await this.storage.read<ConfigTemplate[]>(this.customTemplatesPath)) ||
        []
      );
    } catch {
      return [];
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<ConfigTemplate | null> {
    const categories = await this.getAllTemplates();
    for (const category of categories) {
      const template = category.templates.find((t) => t.id === templateId);
      if (template) return template;
    }
    return null;
  }

  /**
   * Save a custom template
   */
  async saveCustomTemplate(
    template: Omit<ConfigTemplate, 'id' | 'created' | 'updated'>
  ): Promise<ConfigTemplate> {
    const customTemplates = await this.getCustomTemplates();

    const newTemplate: ConfigTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: 'custom',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    customTemplates.push(newTemplate);
    await this.storage.write(this.customTemplatesPath, customTemplates);

    return newTemplate;
  }

  /**
   * Update a custom template
   */
  async updateCustomTemplate(
    templateId: string,
    updates: Partial<ConfigTemplate>
  ): Promise<ConfigTemplate | null> {
    const customTemplates = await this.getCustomTemplates();
    const templateIndex = customTemplates.findIndex((t) => t.id === templateId);

    if (templateIndex === -1) return null;

    const updatedTemplate = {
      ...customTemplates[templateIndex],
      ...updates,
      updated: new Date().toISOString(),
    };

    customTemplates[templateIndex] = updatedTemplate;
    await this.storage.write(this.customTemplatesPath, customTemplates);

    return updatedTemplate;
  }

  /**
   * Delete a custom template
   */
  async deleteCustomTemplate(templateId: string): Promise<boolean> {
    const customTemplates = await this.getCustomTemplates();
    const filteredTemplates = customTemplates.filter(
      (t) => t.id !== templateId
    );

    if (filteredTemplates.length === customTemplates.length) return false;

    await this.storage.write(this.customTemplatesPath, filteredTemplates);
    return true;
  }

  /**
   * Apply template to generate configuration
   */
  async applyTemplate(
    templateId: string,
    customizations?: Record<string, any>
  ): Promise<string> {
    const template = await this.getTemplateById(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    let yamlConfig = template.yaml;

    // Apply customizations if provided
    if (customizations) {
      try {
        const parsed = yaml.parse(yamlConfig);
        const merged = this.mergeCustomizations(parsed, customizations);
        yamlConfig = yaml.stringify(merged, { indent: 2 });
      } catch (error) {
        console.error('Failed to apply customizations:', error);
        // Return original if customization fails
      }
    }

    return yamlConfig;
  }

  /**
   * Merge customizations into template configuration
   */
  private mergeCustomizations(
    config: any,
    customizations: Record<string, any>
  ): any {
    const result = { ...config };

    for (const [key, value] of Object.entries(customizations)) {
      if (value !== undefined && value !== null && value !== '') {
        if (key.includes('.')) {
          // Handle nested keys like 'plex.url'
          const keys = key.split('.');
          let current = result;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in current)) current[keys[i]] = {};
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = value;
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Validate template configuration
   */
  async validateTemplate(
    yamlContent: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      yaml.parse(yamlContent);
      return { valid: true, errors: [] };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Invalid YAML';
      return { valid: false, errors: [errorMessage] };
    }
  }

  /**
   * Generate template preview data
   */
  generatePreview(yamlContent: string): ConfigTemplate['preview'] {
    try {
      const config = yaml.parse(yamlContent);
      const preview: ConfigTemplate['preview'] = {};

      // Count collections
      if (config.collections) {
        preview.collections = Object.keys(config.collections).length;
      }

      // List libraries
      if (config.libraries) {
        preview.libraries = Object.keys(config.libraries);
      }

      // Detect features
      const features: string[] = [];
      if (config.plex) features.push('Plex Integration');
      if (config.tmdb?.apikey) features.push('TMDB API');
      if (config.trakt?.client_id) features.push('Trakt Integration');
      if (config.mal?.client_id) features.push('MyAnimeList');
      if (config.webhooks) features.push('Webhooks');

      preview.features = features;

      return preview;
    } catch {
      return {};
    }
  }

  /**
   * Get default built-in templates
   */
  private getDefaultTemplates(): ConfigTemplate[] {
    return [
      {
        id: 'basic-plex-only',
        name: 'Basic Plex Setup',
        description: 'Simple Plex-only configuration for beginners',
        category: 'basic',
        tags: ['plex', 'beginner', 'simple'],
        version: '1.0.0',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        yaml: `# Basic Plex Configuration
plex:
  url: http://localhost:32400
  token: YOUR_PLEX_TOKEN

libraries:
  Movies:
    collection_files:
      - default: basic
  TV Shows:
    collection_files:
      - default: basic

settings:
  cache: true
  cache_expiring: movie, show
  asset_directory: config/assets
`,
        preview: {
          collections: 2,
          libraries: ['Movies', 'TV Shows'],
          features: ['Plex Integration'],
        },
      },
      {
        id: 'advanced-full-setup',
        name: 'Complete Setup',
        description: 'Full-featured configuration with all major integrations',
        category: 'advanced',
        tags: ['complete', 'tmdb', 'trakt', 'advanced'],
        version: '1.0.0',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        yaml: `# Complete Kometa Configuration
plex:
  url: http://localhost:32400
  token: YOUR_PLEX_TOKEN
  timeout: 60

tmdb:
  apikey: YOUR_TMDB_API_KEY
  language: en

trakt:
  client_id: YOUR_TRAKT_CLIENT_ID
  client_secret: YOUR_TRAKT_CLIENT_SECRET

libraries:
  Movies:
    collection_files:
      - default: award
      - default: genre
      - default: studio
      - default: actor
    operations:
      mass_genre_update: tmdb
      mass_content_rating_update: omdb
      mass_audience_rating_update: mdb_tomatoes
      mass_critic_rating_update: mdb_tomatoes
      
  TV Shows:
    collection_files:
      - default: award
      - default: genre
      - default: network
    operations:
      mass_genre_update: tmdb
      mass_content_rating_update: omdb
      mass_audience_rating_update: mdb_tomatoes

settings:
  cache: true
  cache_expiring: movie, show
  asset_directory: config/assets
  sync_mode: sync
  minimum_items: 1
  delete_below_minimum: true
  default_collection_order: release
  save_missing: true
`,
        preview: {
          collections: 8,
          libraries: ['Movies', 'TV Shows'],
          features: ['Plex Integration', 'TMDB API', 'Trakt Integration'],
        },
      },
      {
        id: 'anime-focused',
        name: 'Anime Configuration',
        description: 'Specialized setup for anime libraries with AniDB and MAL',
        category: 'basic',
        tags: ['anime', 'anidb', 'mal', 'specialized'],
        version: '1.0.0',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        yaml: `# Anime-Focused Configuration
plex:
  url: http://localhost:32400
  token: YOUR_PLEX_TOKEN

anidb:
  username: YOUR_ANIDB_USERNAME
  password: YOUR_ANIDB_PASSWORD

mal:
  client_id: YOUR_MAL_CLIENT_ID
  client_secret: YOUR_MAL_CLIENT_SECRET

libraries:
  Anime:
    collection_files:
      - default: anilist
      - default: myanimelist
    operations:
      mass_genre_update: mal
      mass_content_rating_update: mal
      
settings:
  cache: true
  cache_expiring: show
  asset_directory: config/assets
  sync_mode: sync
`,
        preview: {
          collections: 2,
          libraries: ['Anime'],
          features: ['Plex Integration', 'MyAnimeList', 'AniDB Integration'],
        },
      },
    ];
  }
}
