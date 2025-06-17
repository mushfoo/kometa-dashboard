import { ConfigManager, ConfigTemplate, TemplateVariables } from '../ConfigManager';
import { KometaConfig } from '../ConfigService';
import { promises as fs } from 'fs';
// import path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
  },
}));

// Mock the parent ConfigService methods
jest.mock('../ConfigService', () => {
  return {
    ConfigService: class MockConfigService {
      async validateConfig(config: unknown) {
        // Basic mock validation
        const parsedConfig = config as any;
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!parsedConfig?.plex) {
          errors.push('Plex configuration is required');
        }

        if (!parsedConfig?.tmdb && !parsedConfig?.trakt) {
          warnings.push('No metadata provider (TMDb or Trakt) configured');
        }

        return {
          valid: errors.length === 0,
          errors: errors.length > 0 ? errors : undefined,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      }
    },
  };
});

describe('ConfigManager', () => {
  let manager: ConfigManager;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    manager = new ConfigManager('./test-storage');
    jest.clearAllMocks();
  });

  describe('Template Management', () => {
    test('should load built-in templates', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const templates = await manager.getTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'basic-plex-tmdb',
          name: 'Basic Plex + TMDb Setup',
          category: 'basic',
        }),
        expect.objectContaining({
          id: 'advanced-multi-provider',
          category: 'advanced',
        }),
        expect.objectContaining({
          id: 'anime-specialized',
          category: 'specialized',
        }),
      ]));
    });

    test('should get specific template by ID', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const template = await manager.getTemplate('basic-plex-tmdb');
      
      expect(template).toMatchObject({
        id: 'basic-plex-tmdb',
        name: 'Basic Plex + TMDb Setup',
        category: 'basic',
        config: expect.objectContaining({
          plex: expect.any(Object),
          tmdb: expect.any(Object),
        }),
        variables: expect.objectContaining({
          PLEX_URL: expect.any(Object),
          PLEX_TOKEN: expect.any(Object),
          TMDB_API_KEY: expect.any(Object),
        }),
      });
    });

    test('should return null for non-existent template', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const template = await manager.getTemplate('non-existent');
      expect(template).toBeNull();
    });

    test('should load custom templates from storage', async () => {
      const customTemplate: ConfigTemplate = {
        id: 'custom-test',
        name: 'Custom Test Template',
        description: 'A custom test template',
        category: 'basic',
        config: {
          plex: {
            url: 'http://localhost:32400',
            token: 'test-token',
          },
        },
      };

      mockFs.readdir.mockResolvedValue(['custom-test.json']);
      mockFs.readFile.mockResolvedValue(JSON.stringify(customTemplate));

      const templates = await manager.getTemplates();
      
      expect(templates).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'custom-test',
          name: 'Custom Test Template',
        }),
      ]));
    });

    test('should save custom template', async () => {
      const customTemplate: ConfigTemplate = {
        id: 'new-custom',
        name: 'New Custom Template',
        description: 'A new custom template',
        category: 'basic',
        config: {
          plex: {
            url: '${PLEX_URL}',
            token: '${PLEX_TOKEN}',
          },
        },
      };

      await manager.saveTemplate(customTemplate);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('templates'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('new-custom.json.tmp'),
        JSON.stringify(customTemplate, null, 2),
        'utf-8'
      );
      expect(mockFs.rename).toHaveBeenCalled();
    });

    test('should validate template structure when saving', async () => {
      const invalidTemplate = {
        id: 'invalid',
        // Missing required fields
      } as ConfigTemplate;

      await expect(manager.saveTemplate(invalidTemplate)).rejects.toThrow(
        'Template missing required field'
      );
    });

    test('should delete custom template', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await manager.deleteTemplate('custom-template');
      
      expect(result).toBe(true);
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('custom-template.json')
      );
    });

    test('should handle template deletion errors', async () => {
      mockFs.unlink.mockRejectedValue(new Error('File not found'));

      const result = await manager.deleteTemplate('non-existent');
      
      expect(result).toBe(false);
    });
  });

  describe('Configuration Creation from Templates', () => {
    test('should create configuration from template with variables', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const variables: TemplateVariables = {
        PLEX_URL: 'http://localhost:32400',
        PLEX_TOKEN: 'my-plex-token',
        TMDB_API_KEY: 'my-tmdb-key',
      };

      const config = await manager.createFromTemplate('basic-plex-tmdb', variables);

      expect(config).toMatchObject({
        plex: {
          url: 'http://localhost:32400',
          token: 'my-plex-token',
          timeout: 60,
        },
        tmdb: {
          apikey: 'my-tmdb-key',
          language: 'en',
        },
        settings: expect.any(Object),
      });
    });

    test('should throw error for missing required variables', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const variables: TemplateVariables = {
        PLEX_URL: 'http://localhost:32400',
        // Missing PLEX_TOKEN and TMDB_API_KEY
      };

      await expect(
        manager.createFromTemplate('basic-plex-tmdb', variables)
      ).rejects.toThrow('Required variable missing');
    });

    test('should use default values for optional variables', async () => {
      const templateWithDefaults: ConfigTemplate = {
        id: 'test-defaults',
        name: 'Test Defaults',
        description: 'Template with default values',
        category: 'basic',
        config: {
          plex: {
            url: '${PLEX_URL}',
            token: '${PLEX_TOKEN}',
            timeout: '${TIMEOUT}', // Keep as string for substitution
          },
        },
        variables: {
          PLEX_URL: { description: 'Plex URL', type: 'string', required: true },
          PLEX_TOKEN: { description: 'Plex token', type: 'string', required: true },
          TIMEOUT: { description: 'Timeout', type: 'number', default: 30 },
        },
      };

      // Mock the template loading to return our test template
      jest.spyOn(manager, 'getTemplate').mockResolvedValue(templateWithDefaults);

      const variables: TemplateVariables = {
        PLEX_URL: 'http://localhost:32400',
        PLEX_TOKEN: 'my-token',
        // TIMEOUT not provided, should use default
      };

      const config = await manager.createFromTemplate('test-defaults', variables);

      expect(config.plex?.timeout).toBe(30);
    });

    test('should throw error for non-existent template', async () => {
      mockFs.readdir.mockResolvedValue([]);

      await expect(
        manager.createFromTemplate('non-existent', {})
      ).rejects.toThrow('Template not found');
    });
  });

  describe('Advanced Configuration Validation', () => {
    test('should provide detailed validation with suggestions', async () => {
      const config: KometaConfig = {
        plex: {
          url: 'http://plex.example.com:32400',
          token: 'test-token',
        },
        tmdb: {
          apikey: 'test-key',
        },
        settings: {
          run_again_delay: 2, // Too low
          sync_mode: 'sync',
          delete_below_minimum: false, // Risky with sync mode
        },
      };

      const result = await manager.validateConfigAdvanced(config);

      expect(result.valid).toBe(true);
      expect(result.suggestions).toEqual(expect.arrayContaining([
        expect.stringContaining('run_again_delay'),
      ]));
      expect(result.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining('sync mode'),
        expect.stringContaining('HTTPS'),
      ]));
    });

    test('should suggest asset directory configuration', async () => {
      const config: KometaConfig = {
        plex: { url: 'http://localhost:32400', token: 'test' },
        tmdb: { apikey: 'test' },
      };

      const result = await manager.validateConfigAdvanced(config);

      expect(result.suggestions).toEqual(expect.arrayContaining([
        expect.stringContaining('asset_directory'),
      ]));
    });

    test('should warn about webhook token exposure', async () => {
      const config: KometaConfig = {
        plex: { url: 'http://localhost:32400', token: 'test' },
        tmdb: { apikey: 'test' },
        webhooks: {
          discord: 'https://discord.com/api/webhooks/123/token=exposed-token',
        },
      };

      const result = await manager.validateConfigAdvanced(config);

      expect(result.suggestions).toEqual(expect.arrayContaining([
        expect.stringContaining('environment variables'),
      ]));
    });
  });

  describe('Configuration Suggestions', () => {
    test('should suggest basic templates for new users', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const suggestions = await manager.generateSuggestions();

      expect(suggestions.templates).toEqual(expect.arrayContaining([
        expect.objectContaining({ category: 'basic' }),
      ]));
      expect(suggestions.missingFeatures).toEqual(expect.arrayContaining([
        'Plex server connection',
        'Metadata provider (TMDb/Trakt)',
        'Library configuration',
        'Collection definitions',
      ]));
    });

    test('should suggest improvements for existing configuration', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const currentConfig: KometaConfig = {
        plex: { url: 'http://localhost:32400', token: 'test' },
        // Missing tmdb/trakt, libraries, etc.
      };

      const suggestions = await manager.generateSuggestions(currentConfig);

      expect(suggestions.improvements).toEqual(expect.arrayContaining([
        expect.stringContaining('metadata provider'),
      ]));
    });

    test('should suggest library configuration when missing', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const currentConfig: KometaConfig = {
        plex: { url: 'http://localhost:32400', token: 'test' },
        tmdb: { apikey: 'test' },
        libraries: {},
      };

      const suggestions = await manager.generateSuggestions(currentConfig);

      expect(suggestions.improvements).toEqual(expect.arrayContaining([
        expect.stringContaining('library-specific settings'),
      ]));
    });
  });

  describe('Configuration Migration', () => {
    test('should migrate old configuration format', async () => {
      const oldConfig = {
        plex: {
          server_url: 'http://localhost:32400', // Old field name
          token: 'test-token',
        },
        tmdb: {
          apikey: 'test-key',
        },
      };

      const migratedConfig = await manager.migrateConfig(oldConfig);

      expect(migratedConfig.plex?.url).toBe('http://localhost:32400');
      expect(migratedConfig.plex).not.toHaveProperty('server_url');
    });

    test('should throw error for invalid migrated configuration', async () => {
      const invalidConfig = {
        // Missing required plex configuration
        tmdb: { apikey: 'test' },
      };

      await expect(manager.migrateConfig(invalidConfig)).rejects.toThrow(
        'Migration failed'
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle template loading errors gracefully', async () => {
      mockFs.readdir.mockResolvedValue(['corrupted.json']);
      mockFs.readFile.mockResolvedValue('invalid json content');

      // Should not throw, just log warning and continue
      const templates = await manager.getTemplates();
      
      // Should still return built-in templates
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.id === 'basic-plex-tmdb')).toBe(true);
    });

    test('should handle template save errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const template: ConfigTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test template',
        category: 'basic',
        config: { plex: { url: 'test', token: 'test' } },
      };

      await expect(manager.saveTemplate(template)).rejects.toThrow('Write failed');
      
      // Should attempt cleanup
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    test('should handle missing templates directory', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));

      // Should not throw, just return empty array for custom templates
      const templates = await manager.getTemplates();
      
      // Should still have built-in templates
      expect(templates.length).toBeGreaterThan(0);
    });
  });
});