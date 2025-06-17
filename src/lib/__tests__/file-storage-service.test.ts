import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import {
  FileStorageService,
  createFileStorage,
  TypedFileStorage,
  createTypedStorage,
} from '../file-storage-service';

describe('FileStorageService', () => {
  let tempDir: string;
  let storage: FileStorageService;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    storage = createFileStorage(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('read', () => {
    it('should read and parse JSON files', async () => {
      const testData = { foo: 'bar', count: 42 };
      const filePath = 'test.json';
      await fs.writeFile(
        path.join(tempDir, filePath),
        JSON.stringify(testData)
      );

      const result = await storage.read(filePath);
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent files', async () => {
      const result = await storage.read('non-existent.json');
      expect(result).toBeNull();
    });

    it('should throw error for invalid JSON', async () => {
      const filePath = 'invalid.json';
      await fs.writeFile(path.join(tempDir, filePath), 'not valid json');

      await expect(storage.read(filePath)).rejects.toThrow();
    });

    it('should prevent directory traversal', async () => {
      await expect(storage.read('../../../etc/passwd')).rejects.toThrow(
        'Directory traversal is not allowed'
      );
    });
  });

  describe('write', () => {
    it('should write data as JSON', async () => {
      const testData = { message: 'Hello', items: [1, 2, 3] };
      const filePath = 'output.json';

      await storage.write(filePath, testData);

      const written = await fs.readFile(path.join(tempDir, filePath), 'utf-8');
      expect(JSON.parse(written)).toEqual(testData);
    });

    it('should create directories if they dont exist', async () => {
      const testData = { nested: true };
      const filePath = 'sub/dir/file.json';

      await storage.write(filePath, testData);

      const exists = await storage.exists(filePath);
      expect(exists).toBe(true);
    });

    it('should handle concurrent writes with locking', async () => {
      const filePath = 'concurrent.json';
      const writes = Array.from({ length: 10 }, (_, i) =>
        storage.write(filePath, { value: i })
      );

      await Promise.all(writes);

      const result = await storage.read(filePath);
      expect(result).toHaveProperty('value');
      expect(typeof (result as any).value).toBe('number');
    });

    it('should perform atomic writes', async () => {
      const filePath = 'atomic.json';
      const tempPath = path.join(tempDir, `${filePath}.tmp`);

      // Start a write operation
      const writePromise = storage.write(filePath, { test: 'data' });

      // Check that temp file doesn't linger after completion
      await writePromise;

      const tempExists = await fs
        .access(tempPath)
        .then(() => true)
        .catch(() => false);
      expect(tempExists).toBe(false);

      const finalExists = await storage.exists(filePath);
      expect(finalExists).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete existing files', async () => {
      const filePath = 'to-delete.json';
      await storage.write(filePath, { temp: true });

      expect(await storage.exists(filePath)).toBe(true);

      await storage.delete(filePath);

      expect(await storage.exists(filePath)).toBe(false);
    });

    it('should not throw when deleting non-existent files', async () => {
      await expect(storage.delete('non-existent.json')).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing files', async () => {
      const filePath = 'exists.json';
      await storage.write(filePath, {});

      expect(await storage.exists(filePath)).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      expect(await storage.exists('not-there.json')).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create test files
      await storage.write('dir/file1.json', {});
      await storage.write('dir/file2.json', {});
      await storage.write('dir/data.txt', {});
      await storage.write('dir/backup-file1.json', {});
    });

    it('should list all files in directory', async () => {
      const files = await storage.list('dir');
      expect(files).toHaveLength(4);
      expect(files).toContain('file1.json');
      expect(files).toContain('file2.json');
      expect(files).toContain('data.txt');
      expect(files).toContain('backup-file1.json');
    });

    it('should filter by extension', async () => {
      const files = await storage.list('dir', { extension: '.json' });
      expect(files).toHaveLength(3);
      expect(files).not.toContain('data.txt');
    });

    it('should filter by prefix', async () => {
      const files = await storage.list('dir', { prefix: 'backup-' });
      expect(files).toHaveLength(1);
      expect(files).toContain('backup-file1.json');
    });

    it('should create directory if it doesnt exist', async () => {
      const files = await storage.list('new-dir');
      expect(files).toEqual([]);
      expect(await storage.exists('new-dir')).toBe(false); // exists checks files, not dirs
    });
  });

  describe('createBackup', () => {
    it('should create backup with timestamp', async () => {
      const filePath = 'data.json';
      await storage.write(filePath, { original: true });

      const backupName = await storage.createBackup(filePath);

      expect(backupName).toBeTruthy();
      expect(backupName).toMatch(
        /^data-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_\d{3}Z\.json$/
      );

      const backupData = await storage.read(backupName!);
      expect(backupData).toEqual({ original: true });
    });

    it('should return null for non-existent files', async () => {
      const backup = await storage.createBackup('non-existent.json');
      expect(backup).toBeNull();
    });

    it('should maintain max backups limit', async () => {
      const filePath = 'limited.json';
      await storage.write(filePath, { version: 0 });

      // Create 7 backups with a max of 3
      for (let i = 1; i <= 7; i++) {
        await storage.write(filePath, { version: i });
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay for unique timestamps
        await storage.createBackup(filePath, 3);
      }

      const files = await storage.list('.', { prefix: 'limited-backup-' });
      expect(files).toHaveLength(3);
    });
  });

  describe('restoreBackup', () => {
    it('should restore file from backup', async () => {
      const filePath = 'restore-test.json';
      const originalData = { version: 1 };
      const newData = { version: 2 };

      // Write original data and create backup
      await storage.write(filePath, originalData);
      const backupName = await storage.createBackup(filePath);
      expect(backupName).toBeTruthy();

      // Overwrite with new data
      await storage.write(filePath, newData);
      
      // Verify file has new data before restoration
      const beforeRestore = await storage.read(filePath);
      expect(beforeRestore).toEqual(newData);

      // Restore from backup
      await storage.restoreBackup(backupName!, filePath);

      // Check that file was restored to original data
      const restored = await storage.read(filePath);
      expect(restored).toEqual(originalData);
    });

    it('should create backup before restoring', async () => {
      const filePath = 'safe-restore.json';
      await storage.write(filePath, { current: true });
      await storage.write('backup.json', { backup: true });

      await storage.restoreBackup('backup.json', filePath);

      const files = await storage.list('.', { prefix: 'safe-restore-backup-' });
      expect(files.length).toBeGreaterThan(0);
    });
  });
});

describe('TypedFileStorage', () => {
  let tempDir: string;
  let typedStorage: TypedFileStorage<{ name: string; age: number }>;

  const TestSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'typed-storage-test-'));
    typedStorage = createTypedStorage(tempDir, TestSchema);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should validate data on read', async () => {
    // Write invalid data directly
    await fs.writeFile(
      path.join(tempDir, 'invalid.json'),
      JSON.stringify({ name: 'John', age: 'not-a-number' })
    );

    await expect(typedStorage.read('invalid.json')).rejects.toThrow();
  });

  it('should validate data on write', async () => {
    const invalidData = { name: 'John', age: 'thirty' as any };

    await expect(
      typedStorage.write('test.json', invalidData)
    ).rejects.toThrow();
  });

  it('should work with valid data', async () => {
    const validData = { name: 'Jane', age: 25 };

    await typedStorage.write('valid.json', validData);
    const result = await typedStorage.read('valid.json');

    expect(result).toEqual(validData);
  });

  it('should delegate other methods correctly', async () => {
    const filePath = 'delegate.json';
    const data = { name: 'Test', age: 30 };

    await typedStorage.write(filePath, data);

    expect(await typedStorage.exists(filePath)).toBe(true);

    const backup = await typedStorage.createBackup(filePath);
    expect(backup).toBeTruthy();

    await typedStorage.delete(filePath);
    expect(await typedStorage.exists(filePath)).toBe(false);
  });
});
