import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

/**
 * File storage service for managing JSON file operations with atomic writes
 * and proper error handling. Uses temp files and rename operations to ensure
 * data integrity during writes.
 */
export class FileStorageService {
  private readonly basePath: string;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Read a JSON file and parse its contents
   * @param relativePath - Path relative to the base storage directory
   * @returns Parsed JSON data or null if file doesn't exist
   */
  async read<T = unknown>(relativePath: string): Promise<T | null> {
    const filePath = this.getAbsolutePath(relativePath);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to read file ${relativePath}: ${error}`);
    }
  }

  /**
   * Write data to a JSON file atomically using temp file + rename
   * @param relativePath - Path relative to the base storage directory
   * @param data - Data to write (will be JSON stringified)
   */
  async write(relativePath: string, data: unknown): Promise<void> {
    const filePath = this.getAbsolutePath(relativePath);
    const tempPath = `${filePath}.tmp`;

    // Wait for any existing lock on this file
    const existingLock = this.locks.get(filePath);
    if (existingLock) {
      await existingLock;
    }

    // Create a new lock for this operation
    const lockPromise = this.performWrite(tempPath, filePath, data);
    this.locks.set(filePath, lockPromise);

    try {
      await lockPromise;
    } finally {
      this.locks.delete(filePath);
    }
  }

  /**
   * Delete a file
   * @param relativePath - Path relative to the base storage directory
   */
  async delete(relativePath: string): Promise<void> {
    const filePath = this.getAbsolutePath(relativePath);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Failed to delete file ${relativePath}: ${error}`);
      }
    }
  }

  /**
   * Check if a file exists
   * @param relativePath - Path relative to the base storage directory
   */
  async exists(relativePath: string): Promise<boolean> {
    const filePath = this.getAbsolutePath(relativePath);

    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * List files in a directory
   * @param relativePath - Path relative to the base storage directory
   * @param options - Options for filtering files
   */
  async list(
    relativePath: string,
    options?: {
      extension?: string;
      prefix?: string;
    }
  ): Promise<string[]> {
    const dirPath = this.getAbsolutePath(relativePath);

    try {
      await fs.mkdir(dirPath, { recursive: true });
      const files = await fs.readdir(dirPath);

      let filtered = files;

      if (options?.extension) {
        filtered = filtered.filter((file) => file.endsWith(options.extension!));
      }

      if (options?.prefix) {
        filtered = filtered.filter((file) => file.startsWith(options.prefix!));
      }

      return filtered;
    } catch (error) {
      throw new Error(`Failed to list files in ${relativePath}: ${error}`);
    }
  }

  /**
   * Create a backup of a file with timestamp
   * @param relativePath - Path relative to the base storage directory
   * @param maxBackups - Maximum number of backups to keep
   */
  async createBackup(
    relativePath: string,
    maxBackups = 5
  ): Promise<string | null> {
    const filePath = this.getAbsolutePath(relativePath);

    if (!(await this.exists(relativePath))) {
      return null;
    }

    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);
    const timestamp = new Date()
      .toISOString()
      .replace(/[:]/g, '-')
      .replace(/[.]/g, '_');
    const backupName = `${basename}-backup-${timestamp}${ext}`;
    const backupPath = path.join(dir, backupName);

    // Copy the file to backup
    await fs.copyFile(filePath, backupPath);

    // Clean up old backups
    await this.cleanupBackups(dir, basename, ext, maxBackups);

    return backupName;
  }

  /**
   * Restore a file from backup
   * @param backupPath - Path to the backup file
   * @param targetPath - Path where to restore the file
   */
  async restoreBackup(backupPath: string, targetPath: string): Promise<void> {
    const source = this.getAbsolutePath(backupPath);
    const target = this.getAbsolutePath(targetPath);

    // Create backup of current file before restoring
    if (await this.exists(targetPath)) {
      await this.createBackup(targetPath);
    }

    await fs.copyFile(source, target);
  }

  /**
   * Get absolute path from relative path
   */
  private getAbsolutePath(relativePath: string): string {
    // Prevent directory traversal
    const normalized = path.normalize(relativePath);
    if (normalized.includes('..')) {
      throw new Error('Directory traversal is not allowed');
    }
    return path.join(this.basePath, normalized);
  }

  /**
   * Perform the actual write operation
   */
  private async performWrite(
    tempPath: string,
    filePath: string,
    data: unknown
  ): Promise<void> {
    // Generate unique temp file name to avoid conflicts
    const uniqueTempPath = `${tempPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(7)}`;

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write to temp file
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(uniqueTempPath, jsonData, 'utf-8');

      // Atomic rename
      await fs.rename(uniqueTempPath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(uniqueTempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(`Failed to write file: ${error}`);
    }
  }

  /**
   * Clean up old backup files
   */
  private async cleanupBackups(
    dir: string,
    basename: string,
    ext: string,
    maxBackups: number
  ): Promise<void> {
    const backupPattern = `${basename}-backup-`;
    const files = await fs.readdir(dir);

    const backups = files
      .filter((file) => file.startsWith(backupPattern) && file.endsWith(ext))
      .sort()
      .reverse();

    // Remove old backups
    if (backups.length > maxBackups) {
      const toDelete = backups.slice(maxBackups);
      await Promise.all(
        toDelete.map((file) => fs.unlink(path.join(dir, file)))
      );
    }
  }
}

// Factory function for creating storage services
export function createFileStorage(basePath: string): FileStorageService {
  return new FileStorageService(basePath);
}

// Type-safe storage service with schema validation
export class TypedFileStorage<T> {
  private readonly storage: FileStorageService;
  private readonly schema: z.ZodType<T>;

  constructor(storage: FileStorageService, schema: z.ZodType<T>) {
    this.storage = storage;
    this.schema = schema;
  }

  async read(relativePath: string): Promise<T | null> {
    const data = await this.storage.read(relativePath);
    if (data === null) return null;

    return this.schema.parse(data);
  }

  async write(relativePath: string, data: T): Promise<void> {
    const validated = this.schema.parse(data);
    await this.storage.write(relativePath, validated);
  }

  // Delegate other methods
  async delete(relativePath: string): Promise<void> {
    return this.storage.delete(relativePath);
  }

  async exists(relativePath: string): Promise<boolean> {
    return this.storage.exists(relativePath);
  }

  async list(
    relativePath: string,
    options?: { extension?: string; prefix?: string }
  ): Promise<string[]> {
    return this.storage.list(relativePath, options);
  }

  async createBackup(
    relativePath: string,
    maxBackups = 5
  ): Promise<string | null> {
    return this.storage.createBackup(relativePath, maxBackups);
  }

  async restoreBackup(backupPath: string, targetPath: string): Promise<void> {
    return this.storage.restoreBackup(backupPath, targetPath);
  }
}

// Export convenience function for creating typed storage
export function createTypedStorage<T>(
  basePath: string,
  schema: z.ZodType<T>
): TypedFileStorage<T> {
  const storage = createFileStorage(basePath);
  return new TypedFileStorage(storage, schema);
}
