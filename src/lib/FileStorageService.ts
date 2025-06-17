import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface FileOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class FileStorageService {
  private readonly storageRoot: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 100;

  constructor(storageRoot: string = './storage') {
    this.storageRoot = path.resolve(storageRoot);
  }

  async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async readJSON<T>(filePath: string): Promise<FileOperationResult<T>> {
    try {
      const fullPath = path.resolve(this.storageRoot, filePath);
      const data = await fs.readFile(fullPath, 'utf-8');
      const parsed = JSON.parse(data) as T;
      return { success: true, data: parsed };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Unknown error' };
    }
  }

  async writeJSON<T>(
    filePath: string,
    data: T
  ): Promise<FileOperationResult<void>> {
    const fullPath = path.resolve(this.storageRoot, filePath);
    const dir = path.dirname(fullPath);
    const tempPath = path.join(
      dir,
      `.${path.basename(fullPath)}.tmp.${randomUUID()}`
    );

    try {
      await this.ensureDirectoryExists(dir);

      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, jsonData, 'utf-8');

      await fs.rename(tempPath, fullPath);

      return { success: true };
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async writeJSONWithRetry<T>(
    filePath: string,
    data: T
  ): Promise<FileOperationResult<void>> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const result = await this.writeJSON(filePath, data);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      if (attempt < this.maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * attempt)
        );
      }
    }

    return {
      success: false,
      error: `Failed after ${this.maxRetries} attempts: ${lastError}`,
    };
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.storageRoot, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<FileOperationResult<void>> {
    try {
      const fullPath = path.resolve(this.storageRoot, filePath);
      await fs.unlink(fullPath);
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Unknown error' };
    }
  }

  async listFiles(dirPath: string): Promise<FileOperationResult<string[]>> {
    try {
      const fullPath = path.resolve(this.storageRoot, dirPath);
      const files = await fs.readdir(fullPath);
      return { success: true, data: files };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Unknown error' };
    }
  }

  async createBackup(filePath: string): Promise<FileOperationResult<string>> {
    try {
      const fullPath = path.resolve(this.storageRoot, filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${fullPath}.backup.${timestamp}`;

      await fs.copyFile(fullPath, backupPath);

      return { success: true, data: backupPath };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async cleanupOldBackups(
    filePath: string,
    keepCount: number = 5
  ): Promise<FileOperationResult<void>> {
    try {
      const fullPath = path.resolve(this.storageRoot, filePath);
      const dir = path.dirname(fullPath);
      const baseName = path.basename(fullPath);

      const files = await fs.readdir(dir);
      const backupFiles = files
        .filter((file) => file.startsWith(`${baseName}.backup.`))
        .map((file) => ({
          name: file,
          path: path.join(dir, file),
          stat: fs.stat(path.join(dir, file)),
        }));

      const backupStats = await Promise.all(
        backupFiles.map(async (backup) => ({
          ...backup,
          stat: await backup.stat,
        }))
      );

      const sortedBackups = backupStats
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime())
        .slice(keepCount);

      for (const backup of sortedBackups) {
        await fs.unlink(backup.path);
      }

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  getStorageRoot(): string {
    return this.storageRoot;
  }

  getFullPath(relativePath: string): string {
    return path.resolve(this.storageRoot, relativePath);
  }
}

export const fileStorage = new FileStorageService();
