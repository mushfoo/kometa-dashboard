import { VersionHistoryService } from '../VersionHistoryService';
import { FileStorageService } from '../FileStorageService';

// Mock yaml module
jest.mock('yaml', () => ({
  parse: jest.fn((yamlString: string) => {
    if (yamlString.includes('invalid')) {
      throw new Error('Invalid YAML');
    }
    const result: any = {};
    if (yamlString.includes('plex:')) {
      result.plex = {
        url: yamlString.includes('old-server')
          ? 'http://old-server:32400'
          : 'http://new-server:32400',
      };
      if (yamlString.includes('token')) {
        result.plex.token = yamlString.includes('new-token')
          ? 'new-token'
          : 'token';
      }
    }
    return result;
  }),
  stringify: jest.fn(() => 'test: yaml'),
}));

// Mock FileStorageService
jest.mock('../FileStorageService');
const MockedFileStorageService = FileStorageService as jest.MockedClass<
  typeof FileStorageService
>;

describe('VersionHistoryService', () => {
  let versionService: VersionHistoryService;
  let mockStorageService: jest.Mocked<FileStorageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    versionService = new VersionHistoryService();
    mockStorageService = MockedFileStorageService.mock
      .instances[0] as jest.Mocked<FileStorageService>;
  });

  describe('getVersionHistory', () => {
    it('should return empty array when no history exists', async () => {
      mockStorageService.read.mockRejectedValueOnce(
        new Error('File not found')
      );

      const history = await versionService.getVersionHistory();

      expect(history).toEqual([]);
    });

    it('should return existing version history', async () => {
      const existingVersions = [
        {
          id: 'version-1',
          timestamp: '2023-01-01T00:00:00Z',
          description: 'First version',
          yaml: 'test: yaml',
          hash: 'hash1',
          changeType: 'manual' as const,
          size: 10,
        },
      ];

      mockStorageService.read.mockResolvedValueOnce(existingVersions);

      const history = await versionService.getVersionHistory();

      expect(history).toEqual(existingVersions);
    });
  });

  describe('saveVersion', () => {
    it('should save a new version', async () => {
      mockStorageService.read.mockResolvedValueOnce([]); // Existing versions
      mockStorageService.write.mockResolvedValueOnce(undefined);

      const yaml = 'plex:\n  url: http://localhost:32400';
      const description = 'Test configuration';

      const savedVersion = await versionService.saveVersion(yaml, description);

      expect(savedVersion.yaml).toBe(yaml);
      expect(savedVersion.description).toBe(description);
      expect(savedVersion.changeType).toBe('manual');
      expect(savedVersion.id).toMatch(/^version-/);
      expect(mockStorageService.write).toHaveBeenCalledWith(
        'history/config-versions.json',
        expect.arrayContaining([expect.objectContaining({ description })])
      );
    });

    it('should return existing version if hash matches', async () => {
      const existingVersion = {
        id: 'version-1',
        timestamp: '2023-01-01T00:00:00Z',
        description: 'Existing version',
        yaml: 'test: yaml',
        hash: 'samehash',
        changeType: 'manual' as const,
        size: 10,
      };

      mockStorageService.read.mockResolvedValueOnce([existingVersion]);

      // Mock the hash generation to return the same hash
      const yaml = 'test: yaml';
      const savedVersion = await versionService.saveVersion(
        yaml,
        'New description'
      );

      // Should return existing version since hash matches
      expect(savedVersion.id).toBe(existingVersion.id);
      expect(mockStorageService.write).not.toHaveBeenCalled();
    });

    it('should limit versions to maxVersions', async () => {
      // Create 10 existing versions
      const existingVersions = Array.from({ length: 10 }, (_, i) => ({
        id: `version-${i}`,
        timestamp: '2023-01-01T00:00:00Z',
        description: `Version ${i}`,
        yaml: `test: yaml${i}`,
        hash: `hash${i}`,
        changeType: 'manual' as const,
        size: 10,
      }));

      mockStorageService.read.mockResolvedValueOnce(existingVersions);
      mockStorageService.write.mockResolvedValueOnce(undefined);

      const newYaml = 'new: configuration';
      await versionService.saveVersion(newYaml, 'New version');

      // Should have written exactly 10 versions (new one + 9 old ones)
      const writtenVersions = mockStorageService.write.mock
        .calls[0][1] as any[];
      expect(writtenVersions).toHaveLength(10);
      expect(writtenVersions[0].description).toBe('New version'); // Newest first
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions and return differences', async () => {
      const version1 = {
        id: 'version-1',
        timestamp: '2023-01-01T00:00:00Z',
        description: 'Version 1',
        yaml: 'plex:\n  url: http://old-server:32400',
        hash: 'hash1',
        changeType: 'manual' as const,
        size: 10,
      };

      const version2 = {
        id: 'version-2',
        timestamp: '2023-01-02T00:00:00Z',
        description: 'Version 2',
        yaml: 'plex:\n  url: http://new-server:32400\n  token: new-token',
        hash: 'hash2',
        changeType: 'manual' as const,
        size: 15,
      };

      mockStorageService.read.mockResolvedValueOnce([version1, version2]);

      const diff = await versionService.compareVersions(
        'version-1',
        'version-2'
      );

      expect(diff.added).toContain('plex.token');
      expect(diff.modified).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'plex.url',
            oldValue: 'http://old-server:32400',
            newValue: 'http://new-server:32400',
          }),
        ])
      );
    });

    it('should throw error for non-existent versions', async () => {
      mockStorageService.read.mockResolvedValueOnce([]);

      await expect(
        versionService.compareVersions('non-existent-1', 'non-existent-2')
      ).rejects.toThrow('One or both versions not found');
    });
  });

  describe('deleteVersion', () => {
    it('should delete existing version', async () => {
      const existingVersions = [
        {
          id: 'version-1',
          timestamp: '2023-01-01T00:00:00Z',
          description: 'Version 1',
          yaml: 'test: yaml1',
          hash: 'hash1',
          changeType: 'manual' as const,
          size: 10,
        },
        {
          id: 'version-2',
          timestamp: '2023-01-02T00:00:00Z',
          description: 'Version 2',
          yaml: 'test: yaml2',
          hash: 'hash2',
          changeType: 'manual' as const,
          size: 10,
        },
      ];

      mockStorageService.read.mockResolvedValueOnce(existingVersions);
      mockStorageService.write.mockResolvedValueOnce(undefined);

      const result = await versionService.deleteVersion('version-1');

      expect(result).toBe(true);
      expect(mockStorageService.write).toHaveBeenCalledWith(
        'history/config-versions.json',
        [existingVersions[1]] // Only version-2 should remain
      );
    });

    it('should return false for non-existent version', async () => {
      mockStorageService.read.mockResolvedValueOnce([]);

      const result = await versionService.deleteVersion('non-existent');

      expect(result).toBe(false);
      expect(mockStorageService.write).not.toHaveBeenCalled();
    });
  });

  describe('getVersionsSince', () => {
    it('should return versions since given timestamp', async () => {
      const versions = [
        {
          id: 'version-1',
          timestamp: '2023-01-01T00:00:00Z',
          description: 'Old version',
          yaml: 'test: yaml1',
          hash: 'hash1',
          changeType: 'manual' as const,
          size: 10,
        },
        {
          id: 'version-2',
          timestamp: '2023-01-03T00:00:00Z',
          description: 'New version',
          yaml: 'test: yaml2',
          hash: 'hash2',
          changeType: 'manual' as const,
          size: 10,
        },
      ];

      mockStorageService.read.mockResolvedValueOnce(versions);

      const result = await versionService.getVersionsSince(
        '2023-01-02T00:00:00Z'
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('version-2');
    });
  });

  describe('static utility methods', () => {
    describe('formatFileSize', () => {
      it('should format file sizes correctly', () => {
        expect(VersionHistoryService.formatFileSize(0)).toBe('0 B');
        expect(VersionHistoryService.formatFileSize(1024)).toBe('1 KB');
        expect(VersionHistoryService.formatFileSize(1024 * 1024)).toBe('1 MB');
        expect(VersionHistoryService.formatFileSize(1536)).toBe('1.5 KB');
      });
    });

    describe('formatTimestamp', () => {
      beforeEach(() => {
        // Mock current date to 2023-01-03 12:00:00
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2023-01-03T12:00:00Z'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should format timestamps correctly', () => {
        // Today
        const todayResult = VersionHistoryService.formatTimestamp(
          '2023-01-03T10:30:00Z'
        );
        expect(todayResult).toContain('Today at');

        // Yesterday
        const yesterdayResult = VersionHistoryService.formatTimestamp(
          '2023-01-02T10:30:00Z'
        );
        expect(yesterdayResult).toContain('Yesterday at');

        // Days ago
        const daysAgoResult = VersionHistoryService.formatTimestamp(
          '2023-01-01T10:30:00Z'
        );
        expect(daysAgoResult).toContain('2 days ago');

        // Weeks ago
        const weeksAgoResult = VersionHistoryService.formatTimestamp(
          '2022-12-20T10:30:00Z'
        );
        expect(weeksAgoResult).toContain('Dec');
      });
    });
  });
});
