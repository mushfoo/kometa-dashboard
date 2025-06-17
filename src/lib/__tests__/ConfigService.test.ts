import { ConfigService, KometaConfig } from '../ConfigService';
import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
    copyFile: jest.fn(),
  },
}));

// Mock FileStorageService
jest.mock('../file-storage-service', () => ({
  FileStorageService: jest.fn().mockImplementation(() => ({
    read: jest.fn(),
    write: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    list: jest.fn(),
    createBackup: jest.fn(),
    restoreBackup: jest.fn(),
  })),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigService', () => {
  let configService: ConfigService;
  let mockStorage: any;
  const testBasePath = '/test/storage';

  beforeEach(() => {
    jest.clearAllMocks();
    configService = new ConfigService(testBasePath);
    mockStorage = (configService as any).storage;
  });

  describe('getConfig', () => {
    it('should return null when config file does not exist', async () => {
      // Mock file doesn't exist
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await configService.getConfig();
      expect(result).toBeNull();
    });

    it('should parse and return valid YAML configuration', async () => {
      const validConfig: KometaConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
        tmdb: {
          apikey: 'test-tmdb-key',
        },
      };

      const yamlContent = yaml.dump(validConfig);

      // Mock file exists and can be read
      mockFs.readFile.mockResolvedValue(yamlContent);

      const result = await configService.getConfig();
      expect(result).toEqual(validConfig);
    });

    it('should throw error for invalid YAML', async () => {
      const invalidYaml = 'invalid: yaml: content: [unclosed';

      mockFs.readFile.mockResolvedValue(invalidYaml);

      await expect(configService.getConfig()).rejects.toThrow();
    });

    it('should throw error for YAML that fails schema validation', async () => {
      const invalidConfig = {
        plex: {
          url: 'not-a-url', // Invalid URL
          token: '', // Empty token
        },
      };

      const yamlContent = yaml.dump(invalidConfig);

      mockFs.readFile.mockResolvedValue(yamlContent);

      await expect(configService.getConfig()).rejects.toThrow();
    });
  });

  describe('updateConfig', () => {
    it('should validate and save configuration with backup', async () => {
      const validConfig: KometaConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      };

      // Mock backup creation - file exists for backup
      mockFs.stat.mockResolvedValue({ size: 100, mtime: new Date() } as any);
      mockFs.readdir.mockResolvedValue([]);
      mockFs.copyFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await configService.updateConfig(validConfig);

      // Verify backup was created
      expect(mockFs.copyFile).toHaveBeenCalled();

      // Verify file was written
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockFs.rename).toHaveBeenCalled();

      // Check that YAML was properly formatted
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenContent = writeCall?.[1] as string;
      expect(writtenContent).toContain('plex:');
      expect(writtenContent).toContain('url: http://localhost:32400');
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        plex: {
          url: 'not-a-url',
          token: '',
        },
      };

      await expect(
        configService.updateConfig(invalidConfig as any)
      ).rejects.toThrow();

      // Verify no file operations were performed
      expect(mockFs.writeFile).not.toHaveBeenCalled();
      expect(mockFs.rename).not.toHaveBeenCalled();
    });

    it('should cleanup temp file on write failure', async () => {
      const validConfig: KometaConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      };

      // Mock backup creation success but write failure
      mockFs.stat.mockResolvedValue({ size: 100, mtime: new Date() } as any);
      mockFs.readdir.mockResolvedValue([]);
      mockFs.copyFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
      mockFs.unlink.mockResolvedValue(undefined);

      await expect(configService.updateConfig(validConfig)).rejects.toThrow();

      // Verify cleanup was attempted
      expect(mockFs.unlink).toHaveBeenCalled();
    });
  });

  describe('validateConfig', () => {
    it('should return valid for correct configuration', async () => {
      const validConfig: KometaConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
        tmdb: {
          apikey: 'test-key',
        },
      };

      const result = await configService.validateConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return errors for invalid configuration', async () => {
      const invalidConfig = {
        plex: {
          url: 'not-a-url',
          token: '',
        },
      };

      const result = await configService.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should return warnings for missing recommended fields', async () => {
      const minimalConfig: KometaConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      };

      const result = await configService.validateConfig(minimalConfig);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain(
        'No metadata provider (TMDb or Trakt) configured'
      );
    });

    it('should return error when plex config is missing', async () => {
      const configWithoutPlex = {
        tmdb: {
          apikey: 'test-key',
        },
      };

      const result = await configService.validateConfig(configWithoutPlex);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'plex: Required',
          'Plex configuration is required',
        ])
      );
    });
  });

  describe('backup operations', () => {
    it('should create backup with timestamp', async () => {
      // Mock storage methods
      mockStorage.exists.mockResolvedValue(true);
      mockStorage.createBackup.mockResolvedValue(
        'config-backup-2023-01-01T10-00-00_000Z.yml'
      );

      const backupName = await configService.createBackup();

      expect(backupName).toBeTruthy();
      expect(backupName).toContain('config-backup-');
      expect(mockStorage.createBackup).toHaveBeenCalled();
    });

    it('should return null when no config file exists for backup', async () => {
      mockStorage.exists.mockResolvedValue(false);
      mockStorage.createBackup.mockResolvedValue(null);

      const backupName = await configService.createBackup();

      expect(backupName).toBeNull();
      expect(mockStorage.createBackup).toHaveBeenCalled();
    });

    it('should list backups in reverse chronological order', async () => {
      const backupFiles = [
        'config-backup-2023-01-01T10-00-00_000Z.yml',
        'config-backup-2023-01-02T10-00-00_000Z.yml',
        'config-backup-2023-01-03T10-00-00_000Z.yml',
      ];

      mockStorage.list.mockResolvedValue(backupFiles);

      const backups = await configService.listBackups();

      expect(backups).toEqual([
        'config-backup-2023-01-03T10-00-00_000Z.yml',
        'config-backup-2023-01-02T10-00-00_000Z.yml',
        'config-backup-2023-01-01T10-00-00_000Z.yml',
      ]);
    });
  });

  describe('getConfigStatus', () => {
    it('should return status when config exists', async () => {
      const mockStats = {
        size: 1024,
        mtime: new Date('2023-01-01T12:00:00Z'),
      };

      // Mock the fs.stat call for getConfigStatus and storage.list for backups
      mockFs.stat.mockResolvedValue(mockStats as any);
      mockStorage.list.mockResolvedValue([
        'config-backup-file1.yml',
        'config-backup-file2.yml',
      ]);

      const status = await configService.getConfigStatus();

      expect(status.exists).toBe(true);
      expect(status.size).toBe(1024);
      expect(status.lastModified).toEqual(mockStats.mtime);
      expect(status.backupCount).toBe(2);
    });

    it('should return status when config does not exist', async () => {
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });
      mockStorage.list.mockResolvedValue([]);

      const status = await configService.getConfigStatus();

      expect(status.exists).toBe(false);
      expect(status.size).toBeUndefined();
      expect(status.lastModified).toBeUndefined();
      expect(status.backupCount).toBe(0);
    });
  });
});
