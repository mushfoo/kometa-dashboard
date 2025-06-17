import { FileStorageService } from '../../lib/FileStorageService';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

describe('FileStorageService', () => {
  let service: FileStorageService;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, `test-storage-${randomUUID()}`);
    service = new FileStorageService(testDir);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', async () => {
      const newDir = path.join(testDir, 'new-directory');
      await service.ensureDirectoryExists(newDir);

      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      const existingDir = path.join(testDir, 'existing');
      await fs.mkdir(existingDir);

      await expect(
        service.ensureDirectoryExists(existingDir)
      ).resolves.not.toThrow();
    });
  });

  describe('readJSON', () => {
    it('should read valid JSON file', async () => {
      const testData = { name: 'test', value: 42 };
      const filePath = 'test.json';
      const fullPath = path.join(testDir, filePath);

      await fs.writeFile(fullPath, JSON.stringify(testData));

      const result = await service.readJSON(filePath);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
    });

    it('should return error for non-existent file', async () => {
      const result = await service.readJSON('non-existent.json');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for invalid JSON', async () => {
      const filePath = 'invalid.json';
      const fullPath = path.join(testDir, filePath);

      await fs.writeFile(fullPath, '{ invalid json }');

      const result = await service.readJSON(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });
  });

  describe('writeJSON', () => {
    it('should write JSON data atomically', async () => {
      const testData = { name: 'test', value: 42 };
      const filePath = 'test.json';

      const result = await service.writeJSON(filePath, testData);

      expect(result.success).toBe(true);

      const readResult = await service.readJSON(filePath);
      expect(readResult.success).toBe(true);
      expect(readResult.data).toEqual(testData);
    });

    it('should create directories if they do not exist', async () => {
      const testData = { test: true };
      const filePath = 'nested/deep/test.json';

      const result = await service.writeJSON(filePath, testData);

      expect(result.success).toBe(true);

      const readResult = await service.readJSON(filePath);
      expect(readResult.success).toBe(true);
      expect(readResult.data).toEqual(testData);
    });
  });

  describe('writeJSONWithRetry', () => {
    it('should succeed on first attempt for valid write', async () => {
      const testData = { retry: 'test' };
      const filePath = 'retry-test.json';

      const result = await service.writeJSONWithRetry(filePath, testData);

      expect(result.success).toBe(true);

      const readResult = await service.readJSON(filePath);
      expect(readResult.success).toBe(true);
      expect(readResult.data).toEqual(testData);
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const filePath = 'exists-test.json';
      const fullPath = path.join(testDir, filePath);

      await fs.writeFile(fullPath, '{}');

      const exists = await service.exists(filePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await service.exists('non-existent.json');
      expect(exists).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      const filePath = 'delete-test.json';
      const fullPath = path.join(testDir, filePath);

      await fs.writeFile(fullPath, '{}');

      const result = await service.deleteFile(filePath);
      expect(result.success).toBe(true);

      const exists = await service.exists(filePath);
      expect(exists).toBe(false);
    });

    it('should return error for non-existent file', async () => {
      const result = await service.deleteFile('non-existent.json');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('listFiles', () => {
    it('should list files in directory', async () => {
      const files = ['file1.json', 'file2.json', 'file3.txt'];

      for (const file of files) {
        const fullPath = path.join(testDir, file);
        await fs.writeFile(fullPath, '{}');
      }

      const result = await service.listFiles('.');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.arrayContaining(files));
    });

    it('should return error for non-existent directory', async () => {
      const result = await service.listFiles('non-existent-dir');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createBackup', () => {
    it('should create backup of existing file', async () => {
      const testData = { backup: 'test' };
      const filePath = 'backup-test.json';

      await service.writeJSON(filePath, testData);

      const result = await service.createBackup(filePath);

      expect(result.success).toBe(true);
      expect(result.data).toMatch(
        /backup-test\.json\.backup\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/
      );

      const backupExists = await fs
        .access(result.data!)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);
    });
  });

  describe('cleanupOldBackups', () => {
    it('should keep specified number of recent backups', async () => {
      const testData = { cleanup: 'test' };
      const filePath = 'cleanup-test.json';

      await service.writeJSON(filePath, testData);

      // Create multiple backups
      const backups: string[] = [];
      for (let i = 0; i < 7; i++) {
        const result = await service.createBackup(filePath);
        if (result.success && result.data) {
          backups.push(result.data);
        }
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await service.cleanupOldBackups(filePath, 3);

      // Check that only 3 backups remain
      const listResult = await service.listFiles('.');
      if (listResult.success && listResult.data) {
        const remainingBackups = listResult.data.filter((file) =>
          file.includes('cleanup-test.json.backup.')
        );
        expect(remainingBackups).toHaveLength(3);
      }
    });
  });

  describe('utility methods', () => {
    it('should return correct storage root', () => {
      expect(service.getStorageRoot()).toBe(testDir);
    });

    it('should return correct full path', () => {
      const relativePath = 'test/file.json';
      const expected = path.resolve(testDir, relativePath);
      expect(service.getFullPath(relativePath)).toBe(expected);
    });
  });
});
