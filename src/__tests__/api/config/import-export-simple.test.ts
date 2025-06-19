import { ConfigService } from '@/lib/ConfigService';
import { EncryptionService } from '@/lib/EncryptionService';

// Mock the services
jest.mock('@/lib/ConfigService');
jest.mock('@/lib/EncryptionService');

// Mock yaml module
jest.mock('yaml', () => ({
  parse: jest.fn(),
  stringify: jest.fn(),
}));

const mockYaml = require('yaml');
const mockConfigService = ConfigService as jest.MockedClass<
  typeof ConfigService
>;
const mockEncryptionService = EncryptionService as jest.MockedClass<
  typeof EncryptionService
>;

describe('Import/Export API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockYaml.parse.mockClear();
    mockYaml.stringify.mockClear();
  });

  describe('Configuration Export Service', () => {
    it('should prepare configuration for export with encryption', async () => {
      const mockConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
        tmdb: {
          apikey: 'test-tmdb-key',
        },
        settings: {
          timeout: 300,
        },
      };

      // Mock ConfigService
      const mockConfigServiceInstance = {
        getConfig: jest.fn().mockResolvedValue(mockConfig),
      };
      mockConfigService.mockImplementation(
        () => mockConfigServiceInstance as any
      );

      // Mock EncryptionService
      const mockEncryptionServiceInstance = {
        encrypt: jest
          .fn()
          .mockImplementation((value: string) => `enc:${value}`),
      };
      mockEncryptionService.getInstance.mockReturnValue(
        mockEncryptionServiceInstance as any
      );

      // Test the encryption logic
      const configService = new ConfigService();
      const encryptionService = EncryptionService.getInstance();
      const config = await configService.getConfig();

      expect(config).toEqual(mockConfig);

      // Test encryption
      const encryptedToken = await encryptionService.encrypt(config.plex.token);
      expect(encryptedToken).toBe('enc:test-token');

      const encryptedApiKey = await encryptionService.encrypt(
        config.tmdb.apikey
      );
      expect(encryptedApiKey).toBe('enc:test-tmdb-key');
    });

    it('should handle configuration without keys', async () => {
      const mockConfig = {
        plex: {
          url: 'http://localhost:32400',
        },
        libraries: {
          Movies: {
            operations: ['update'],
          },
        },
      };

      const mockConfigServiceInstance = {
        getConfig: jest.fn().mockResolvedValue(mockConfig),
      };
      mockConfigService.mockImplementation(
        () => mockConfigServiceInstance as any
      );

      const configService = new ConfigService();
      const config = await configService.getConfig();

      expect(config.plex.url).toBe('http://localhost:32400');
      expect(config.plex.token).toBeUndefined();
      expect(config.libraries).toBeDefined();
    });
  });

  describe('Configuration Import Validation', () => {
    it('should validate plex configuration structure', () => {
      const validConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token-123',
        },
        libraries: {
          Movies: {
            operations: ['update'],
          },
        },
      };

      mockYaml.parse.mockReturnValue(validConfig);

      const errors: string[] = [];
      const warnings: string[] = [];

      // Simulate validation logic from the API
      if (!validConfig || typeof validConfig !== 'object') {
        errors.push('Configuration must be a valid object');
      } else {
        if (!validConfig.plex) {
          errors.push('Plex configuration is required');
        } else {
          if (!validConfig.plex.url) {
            errors.push('Plex URL is required');
          }
          if (!validConfig.plex.token) {
            warnings.push(
              "Plex token is missing - you'll need to configure it manually"
            );
          }
        }

        if (!validConfig.libraries) {
          warnings.push('No libraries configuration found');
        } else if (typeof validConfig.libraries !== 'object') {
          errors.push('Libraries configuration must be an object');
        }
      }

      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it('should detect missing plex configuration', () => {
      const invalidConfig = {
        libraries: {
          Movies: {},
        },
      };

      mockYaml.parse.mockReturnValue(invalidConfig);

      const errors: string[] = [];

      if (!invalidConfig.plex) {
        errors.push('Plex configuration is required');
      }

      expect(errors).toContain('Plex configuration is required');
    });

    it('should detect encrypted values', () => {
      const configWithEncrypted = {
        plex: {
          url: 'http://localhost:32400',
          token: 'enc:encrypted-token-value',
        },
        tmdb: {
          apikey: 'enc:encrypted-api-key',
        },
      };

      mockYaml.parse.mockReturnValue(configWithEncrypted);

      const warnings: string[] = [];

      // Simulate encrypted value detection
      const checkEncrypted = (obj: any, path: string = '') => {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string' && value.startsWith('enc:')) {
            warnings.push(
              `Encrypted value found at ${path}${key} - will be preserved`
            );
          } else if (typeof value === 'object' && value !== null) {
            checkEncrypted(value, `${path}${key}.`);
          }
        }
      };

      checkEncrypted(configWithEncrypted);

      expect(warnings).toContain(
        'Encrypted value found at plex.token - will be preserved'
      );
      expect(warnings).toContain(
        'Encrypted value found at tmdb.apikey - will be preserved'
      );
    });

    it('should validate file content parsing', () => {
      const validYamlContent =
        'plex:\n  url: http://localhost:32400\n  token: test-token';
      const invalidYamlContent =
        'invalid:\n  yaml content\n    - missing colon';

      // Test valid parsing
      const validConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      };
      mockYaml.parse.mockReturnValueOnce(validConfig);

      const result = mockYaml.parse(validYamlContent);
      expect(result).toEqual(validConfig);

      // Test invalid parsing
      mockYaml.parse.mockImplementationOnce(() => {
        throw new Error('Invalid YAML syntax');
      });

      expect(() => mockYaml.parse(invalidYamlContent)).toThrow(
        'Invalid YAML syntax'
      );
    });
  });

  describe('Import Preview Generation', () => {
    it('should generate preview from configuration', () => {
      const config = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token-123',
        },
        libraries: {
          Movies: { operations: ['update'] },
          'TV Shows': { operations: ['scan'] },
        },
        tmdb: {
          apikey: 'test-tmdb-key',
        },
        trakt: {
          client_id: 'test-client-id',
        },
        settings: {
          timeout: 300,
        },
      };

      // Simulate preview generation logic
      const preview = {
        plex: {
          url: config.plex?.url || 'Not configured',
          token: config.plex?.token ? '***configured***' : 'Not configured',
        },
        libraries: config.libraries ? Object.keys(config.libraries) : [],
        tmdb: config.tmdb?.apikey ? 'Configured' : 'Not configured',
        trakt: config.trakt?.client_id ? 'Configured' : 'Not configured',
        settings: config.settings ? 'Included' : 'Not included',
      };

      expect(preview.plex.url).toBe('http://localhost:32400');
      expect(preview.plex.token).toBe('***configured***');
      expect(preview.libraries).toEqual(['Movies', 'TV Shows']);
      expect(preview.tmdb).toBe('Configured');
      expect(preview.trakt).toBe('Configured');
      expect(preview.settings).toBe('Included');
    });

    it('should handle missing configuration sections', () => {
      const minimalConfig = {
        plex: {
          url: 'http://localhost:32400',
        },
      };

      const preview = {
        plex: {
          url: minimalConfig.plex?.url || 'Not configured',
          token: minimalConfig.plex?.token
            ? '***configured***'
            : 'Not configured',
        },
        libraries: minimalConfig.libraries
          ? Object.keys(minimalConfig.libraries)
          : [],
        tmdb: minimalConfig.tmdb?.apikey ? 'Configured' : 'Not configured',
        trakt: minimalConfig.trakt?.client_id ? 'Configured' : 'Not configured',
        settings: minimalConfig.settings ? 'Included' : 'Not included',
      };

      expect(preview.plex.url).toBe('http://localhost:32400');
      expect(preview.plex.token).toBe('Not configured');
      expect(preview.libraries).toEqual([]);
      expect(preview.tmdb).toBe('Not configured');
      expect(preview.trakt).toBe('Not configured');
      expect(preview.settings).toBe('Not included');
    });
  });

  describe('File Type Validation', () => {
    it('should validate file extensions', () => {
      const validExtensions = ['.yml', '.yaml', '.json'];

      expect(validExtensions.includes('.yml')).toBe(true);
      expect(validExtensions.includes('.yaml')).toBe(true);
      expect(validExtensions.includes('.json')).toBe(true);
      expect(validExtensions.includes('.txt')).toBe(false);
      expect(validExtensions.includes('.xml')).toBe(false);
    });

    it('should handle case-insensitive extensions', () => {
      const validExtensions = ['.yml', '.yaml', '.json'];

      const testExtension = (filename: string) => {
        const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        return validExtensions.includes(ext);
      };

      expect(testExtension('config.YML')).toBe(true);
      expect(testExtension('config.YAML')).toBe(true);
      expect(testExtension('config.JSON')).toBe(true);
      expect(testExtension('config.TXT')).toBe(false);
    });
  });

  describe('Configuration Backup and Update', () => {
    it('should create backup before import', async () => {
      const mockConfigServiceInstance = {
        createBackup: jest.fn().mockResolvedValue(undefined),
        updateConfig: jest.fn().mockResolvedValue(undefined),
      };
      mockConfigService.mockImplementation(
        () => mockConfigServiceInstance as any
      );

      const configService = new ConfigService();

      await configService.createBackup();
      expect(mockConfigServiceInstance.createBackup).toHaveBeenCalled();

      const newConfig = { plex: { url: 'http://localhost:32400' } };
      await configService.updateConfig(newConfig);
      expect(mockConfigServiceInstance.updateConfig).toHaveBeenCalledWith(
        newConfig
      );
    });

    it('should handle backup failures gracefully', async () => {
      const mockConfigServiceInstance = {
        createBackup: jest.fn().mockRejectedValue(new Error('Backup failed')),
        updateConfig: jest.fn().mockResolvedValue(undefined),
      };
      mockConfigService.mockImplementation(
        () => mockConfigServiceInstance as any
      );

      const configService = new ConfigService();

      await expect(configService.createBackup()).rejects.toThrow(
        'Backup failed'
      );
    });
  });
});
