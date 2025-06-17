import { ConfigService, KometaConfig } from '../ConfigService';
import { promises as fs } from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import os from 'os';

describe('ConfigService', () => {
  let configService: ConfigService;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
    configService = new ConfigService(testDir);
  });

  afterEach(async () => {
    // Clean up the temporary directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('getConfig', () => {
    it('should return null when config file does not exist', async () => {
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
      await fs.writeFile(path.join(testDir, 'config.yml'), yamlContent);

      const result = await configService.getConfig();
      expect(result).toEqual(validConfig);
    });

    it('should throw error for invalid YAML', async () => {
      const invalidYaml = 'invalid: yaml: content: [unclosed';
      await fs.writeFile(path.join(testDir, 'config.yml'), invalidYaml);

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
      await fs.writeFile(path.join(testDir, 'config.yml'), yamlContent);

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

      // Create initial config for backup
      const initialYaml = yaml.dump({
        plex: { url: 'http://old', token: 'old' },
      });
      await fs.writeFile(path.join(testDir, 'config.yml'), initialYaml);

      await configService.updateConfig(validConfig);

      // Verify file was written
      const writtenContent = await fs.readFile(
        path.join(testDir, 'config.yml'),
        'utf-8'
      );
      const parsedContent = yaml.load(writtenContent) as KometaConfig;
      expect(parsedContent).toEqual(validConfig);

      // Verify backup was created
      const files = await fs.readdir(testDir);
      const backupFiles = files.filter((f) => f.startsWith('config-backup-'));
      expect(backupFiles.length).toBeGreaterThan(0);
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

      // Verify no file was created
      const files = await fs.readdir(testDir);
      expect(files.filter((f) => f === 'config.yml')).toHaveLength(0);
    });

    it('should handle write errors gracefully', async () => {
      const validConfig: KometaConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      };

      // Make directory read-only to cause write error
      await fs.chmod(testDir, 0o555);

      await expect(configService.updateConfig(validConfig)).rejects.toThrow();

      // Restore permissions for cleanup
      await fs.chmod(testDir, 0o755);
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
      expect(result.errors).toBeDefined();
      // Check for either Zod error or custom error message
      const hasPlexError = result.errors?.some(
        (e) => e.includes('plex') || e.includes('Plex')
      );
      expect(hasPlexError).toBe(true);
    });
  });

  describe('backup operations', () => {
    it('should create backup with timestamp', async () => {
      // Create initial config
      const config = { plex: { url: 'http://localhost:32400', token: 'test' } };
      await fs.writeFile(path.join(testDir, 'config.yml'), yaml.dump(config));

      const backupName = await configService.createBackup();

      expect(backupName).toBeTruthy();
      expect(backupName).toContain('config-backup-');

      // Verify backup file exists
      const backupPath = path.join(testDir, backupName!);
      const backupExists = await fs
        .access(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);
    });

    it('should return null when no config file exists for backup', async () => {
      const backupName = await configService.createBackup();
      expect(backupName).toBeNull();
    });

    it('should list backups in reverse chronological order', async () => {
      // Create config file
      const config = { plex: { url: 'http://localhost:32400', token: 'test' } };
      await fs.writeFile(path.join(testDir, 'config.yml'), yaml.dump(config));

      // Create multiple backups with small delays
      await configService.createBackup();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await configService.createBackup();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await configService.createBackup();

      const backups = await configService.listBackups();

      expect(backups.length).toBe(3);
      // Verify they're sorted in reverse chronological order
      for (let i = 1; i < backups.length; i++) {
        expect(backups[i - 1] > backups[i]).toBe(true);
      }
    });

    it('should limit number of backups', async () => {
      // Create config file
      const config = { plex: { url: 'http://localhost:32400', token: 'test' } };
      await fs.writeFile(path.join(testDir, 'config.yml'), yaml.dump(config));

      // Create more than 5 backups
      for (let i = 0; i < 7; i++) {
        await configService.createBackup();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const backups = await configService.listBackups();
      expect(backups.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getConfigStatus', () => {
    it('should return status when config exists', async () => {
      const config = { plex: { url: 'http://localhost:32400', token: 'test' } };
      const yamlContent = yaml.dump(config);
      await fs.writeFile(path.join(testDir, 'config.yml'), yamlContent);

      // Create some backups
      await configService.createBackup();
      await configService.createBackup();

      const status = await configService.getConfigStatus();

      expect(status.exists).toBe(true);
      expect(status.size).toBeGreaterThan(0);
      expect(status.lastModified).toBeDefined();
      expect(status.lastModified instanceof Date).toBe(true);
      expect(status.backupCount).toBe(2);
    });

    it('should return status when config does not exist', async () => {
      const status = await configService.getConfigStatus();

      expect(status.exists).toBe(false);
      expect(status.size).toBeUndefined();
      expect(status.lastModified).toBeUndefined();
      expect(status.backupCount).toBe(0);
    });
  });
});
