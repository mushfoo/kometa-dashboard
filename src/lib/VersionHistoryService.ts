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

export interface ConfigVersion {
  id: string;
  timestamp: string;
  description: string;
  yaml: string;
  hash: string;
  user?: string;
  changeType: 'manual' | 'template' | 'import' | 'form';
  size: number;
  stats?: {
    collections?: number;
    libraries?: number;
    features?: string[];
  };
}

export interface VersionDiff {
  added: string[];
  removed: string[];
  modified: { path: string; oldValue: any; newValue: any }[];
}

export class VersionHistoryService {
  private storage: BrowserStorageService;
  private readonly historyPath = 'history/config-versions.json';
  private readonly maxVersions = 10;

  constructor() {
    this.storage = new BrowserStorageService();
  }

  /**
   * Get all configuration versions
   */
  async getVersionHistory(): Promise<ConfigVersion[]> {
    try {
      const versions = await this.storage.read<ConfigVersion[]>(
        this.historyPath
      );
      return versions || [];
    } catch {
      return [];
    }
  }

  /**
   * Save a new configuration version
   */
  async saveVersion(
    yaml: string,
    description: string,
    changeType: ConfigVersion['changeType'] = 'manual'
  ): Promise<ConfigVersion> {
    const versions = await this.getVersionHistory();

    // Generate hash for duplicate detection
    const hash = await this.generateHash(yaml);

    // Check if this exact configuration already exists
    const existingVersion = versions.find((v) => v.hash === hash);
    if (existingVersion) {
      return existingVersion;
    }

    const stats = this.generateStats(yaml);
    const newVersion: ConfigVersion = {
      id: `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      description,
      yaml,
      hash,
      changeType,
      size: new Blob([yaml]).size,
      ...(stats && { stats }),
    };

    // Add to beginning of array (newest first)
    versions.unshift(newVersion);

    // Keep only the last N versions
    if (versions.length > this.maxVersions) {
      versions.splice(this.maxVersions);
    }

    await this.storage.write(this.historyPath, versions);
    return newVersion;
  }

  /**
   * Get a specific version by ID
   */
  async getVersionById(versionId: string): Promise<ConfigVersion | null> {
    const versions = await this.getVersionHistory();
    return versions.find((v) => v.id === versionId) || null;
  }

  /**
   * Delete a version
   */
  async deleteVersion(versionId: string): Promise<boolean> {
    const versions = await this.getVersionHistory();
    const filteredVersions = versions.filter((v) => v.id !== versionId);

    if (filteredVersions.length === versions.length) return false;

    await this.storage.write(this.historyPath, filteredVersions);
    return true;
  }

  /**
   * Compare two versions and return differences
   */
  async compareVersions(
    fromVersionId: string,
    toVersionId: string
  ): Promise<VersionDiff> {
    const versions = await this.getVersionHistory();
    const fromVersion = versions.find((v) => v.id === fromVersionId);
    const toVersion = versions.find((v) => v.id === toVersionId);

    if (!fromVersion || !toVersion) {
      throw new Error('One or both versions not found');
    }

    return this.calculateDiff(fromVersion.yaml, toVersion.yaml);
  }

  /**
   * Get version changes since a specific timestamp
   */
  async getVersionsSince(timestamp: string): Promise<ConfigVersion[]> {
    const versions = await this.getVersionHistory();
    return versions.filter((v) => new Date(v.timestamp) > new Date(timestamp));
  }

  /**
   * Generate a simple hash for content comparison
   */
  private async generateHash(content: string): Promise<string> {
    // Simple hash function for browser compatibility
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate configuration statistics
   */
  private generateStats(yamlContent: string): ConfigVersion['stats'] {
    try {
      const config = yaml.parse(yamlContent);
      const stats: ConfigVersion['stats'] = {};

      // Count collections
      if (config.collections) {
        stats.collections = Object.keys(config.collections).length;
      }

      // Count libraries
      if (config.libraries) {
        stats.libraries = Object.keys(config.libraries).length;
      }

      // Detect features
      const features: string[] = [];
      if (config.plex) features.push('Plex');
      if (config.tmdb?.apikey) features.push('TMDB');
      if (config.trakt?.client_id) features.push('Trakt');
      if (config.mal?.client_id) features.push('MAL');
      if (config.anidb?.username) features.push('AniDB');
      if (config.webhooks) features.push('Webhooks');

      stats.features = features;

      return stats;
    } catch {
      return {};
    }
  }

  /**
   * Calculate differences between two YAML configurations
   */
  private calculateDiff(fromYaml: string, toYaml: string): VersionDiff {
    try {
      const fromConfig = yaml.parse(fromYaml) || {};
      const toConfig = yaml.parse(toYaml) || {};

      const diff: VersionDiff = {
        added: [],
        removed: [],
        modified: [],
      };

      // Get all keys from both configurations
      const allKeys = new Set([
        ...this.getAllKeys(fromConfig),
        ...this.getAllKeys(toConfig),
      ]);

      for (const key of allKeys) {
        const fromValue = this.getValueByPath(fromConfig, key);
        const toValue = this.getValueByPath(toConfig, key);

        if (fromValue === undefined && toValue !== undefined) {
          diff.added.push(key);
        } else if (fromValue !== undefined && toValue === undefined) {
          diff.removed.push(key);
        } else if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
          diff.modified.push({
            path: key,
            oldValue: fromValue,
            newValue: toValue,
          });
        }
      }

      return diff;
    } catch {
      // Fallback to line-by-line comparison if YAML parsing fails
      const fromLines = fromYaml.split('\n');
      const toLines = toYaml.split('\n');

      return {
        added: toLines
          .filter((line, index) => fromLines[index] !== line)
          .map((_, index) => `line ${index + 1}`),
        removed: fromLines
          .filter((line, index) => toLines[index] !== line)
          .map((_, index) => `line ${index + 1}`),
        modified: [],
      };
    }
  }

  /**
   * Get all nested keys from an object
   */
  private getAllKeys(obj: any, prefix: string = ''): string[] {
    const keys: string[] = [];

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        keys.push(fullKey);

        if (
          typeof obj[key] === 'object' &&
          obj[key] !== null &&
          !Array.isArray(obj[key])
        ) {
          keys.push(...this.getAllKeys(obj[key], fullKey));
        }
      }
    }

    return keys;
  }

  /**
   * Get value by dot-notation path
   */
  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Format timestamp for display
   */
  static formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
}
