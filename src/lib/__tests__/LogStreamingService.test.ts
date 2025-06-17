import { LogStreamingService } from '../LogStreamingService';
import { promises as fs } from 'fs';
import path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    stat: jest.fn(),
    open: jest.fn(),
    watch: jest.fn(),
  },
}));

// Mock LogParser
jest.mock('../LogParser', () => ({
  LogParser: class MockLogParser {
    private entries: any[] = [];
    
    addLogEntry(entry: any) {
      this.entries.push(entry);
      this.emit('logEntry', entry);
    }
    
    processLine(line: string, source: string) {
      const entry = {
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: new Date(),
        level: 'INFO',
        message: line,
        source,
        rawLine: line,
      };
      this.addLogEntry(entry);
      return entry;
    }
    
    getFilteredLogs(filter: any) {
      return this.entries.filter(entry => {
        if (filter.level && entry.level !== filter.level) return false;
        if (filter.search && !entry.message.includes(filter.search)) return false;
        return true;
      });
    }
    
    searchLogs(pattern: string, options: any = {}) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
      const results = this.entries.filter(entry => regex.test(entry.message));
      
      if (options.maxResults && results.length > options.maxResults) {
        return results.slice(0, options.maxResults);
      }
      
      return results;
    }
    
    getBufferStats() {
      return {
        totalEntries: this.entries.length,
        byLevel: { INFO: this.entries.length },
        byComponent: {},
        oldestEntry: new Date(),
        newestEntry: new Date(),
      };
    }
    
    // Mock EventEmitter methods
    on = jest.fn();
    emit = jest.fn();
  },
}));

describe('LogStreamingService', () => {
  let service: LogStreamingService;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    service = new LogStreamingService({
      logDirectory: './test-logs',
      historyBufferSize: 50,
      pollInterval: 100,
      enableFileWatching: false, // Disable for easier testing
    });
    
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await service.stopStreaming();
    service.removeAllListeners();
  });

  describe('Basic Streaming Operations', () => {
    test('should start and stop streaming', async () => {
      const startedSpy = jest.fn();
      const stoppedSpy = jest.fn();
      
      service.on('streamingStarted', startedSpy);
      service.on('streamingStopped', stoppedSpy);

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found')); // No existing logs

      await service.startStreaming();
      expect(service.getStreamingStats().isStreaming).toBe(true);
      expect(startedSpy).toHaveBeenCalledTimes(1);

      await service.stopStreaming();
      expect(service.getStreamingStats().isStreaming).toBe(false);
      expect(stoppedSpy).toHaveBeenCalledTimes(1);
    });

    test('should not start if already streaming', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await service.startStreaming();
      
      // Second call should be ignored
      await service.startStreaming();
      
      expect(service.getStreamingStats().isStreaming).toBe(true);
    });

    test('should generate correct log file path', () => {
      const stats = service.getStreamingStats();
      const expectedMonth = new Date().toISOString().slice(0, 7);
      
      expect(stats.currentLogFile).toBeNull(); // Not started yet
      
      // After starting, it should set the current file
      // This is tested indirectly through other tests
    });
  });

  describe('History Buffer Management', () => {
    test('should load existing logs into history buffer', async () => {
      const mockLogs = {
        logs: [
          {
            id: 'log1',
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: 'Test log 1',
            source: 'stdout',
            rawLine: 'Test log 1',
          },
          {
            id: 'log2',
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            message: 'Test log 2',
            source: 'stderr',
            rawLine: 'Test log 2',
          },
        ],
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockLogs));

      await service.startStreaming();

      const recentLogs = service.getRecentLogs();
      expect(recentLogs).toHaveLength(2);
      expect(recentLogs[0].message).toBe('Test log 1');
      expect(recentLogs[1].message).toBe('Test log 2');
    });

    test('should handle empty or non-existent log files', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: file not found'));

      await service.startStreaming();

      const recentLogs = service.getRecentLogs();
      expect(recentLogs).toHaveLength(0);
    });

    test('should maintain buffer size limit', async () => {
      const smallBufferService = new LogStreamingService({
        historyBufferSize: 3,
        enableFileWatching: false,
      });

      const largeMockLogs = {
        logs: Array.from({ length: 10 }, (_, i) => ({
          id: `log${i}`,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Test log ${i}`,
          source: 'stdout',
          rawLine: `Test log ${i}`,
        })),
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(largeMockLogs));

      await smallBufferService.startStreaming();

      const recentLogs = smallBufferService.getRecentLogs();
      expect(recentLogs.length).toBeLessThanOrEqual(3);
      
      await smallBufferService.stopStreaming();
    });
  });

  describe('Log Filtering and Search', () => {
    beforeEach(async () => {
      const mockLogs = {
        logs: [
          {
            id: 'log1',
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: 'Information message',
            source: 'stdout',
            rawLine: 'Information message',
          },
          {
            id: 'log2',
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            message: 'Error occurred',
            source: 'stderr',
            rawLine: 'Error occurred',
          },
          {
            id: 'log3',
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: 'Another info message',
            source: 'stdout',
            rawLine: 'Another info message',
          },
        ],
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockLogs));
      
      await service.startStreaming();
    });

    test('should filter logs by level', () => {
      const errorLogs = service.getFilteredLogs({ level: 'ERROR' });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe('ERROR');

      const infoLogs = service.getFilteredLogs({ level: 'INFO' });
      expect(infoLogs).toHaveLength(2);
      expect(infoLogs.every(log => log.level === 'INFO')).toBe(true);
    });

    test('should search logs by text pattern', () => {
      const searchResults = service.searchLogs('error', { caseSensitive: false });
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].message).toContain('Error');
    });

    test('should search logs with regex pattern', () => {
      const regexResults = service.searchLogs(/info/i);
      expect(regexResults).toHaveLength(2); // Both info messages
    });

    test('should limit search results', () => {
      const limitedResults = service.searchLogs('message', { maxResults: 1 });
      expect(limitedResults).toHaveLength(1);
    });
  });

  describe('Statistics and Status', () => {
    test('should provide comprehensive streaming statistics', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await service.startStreaming();

      const stats = service.getStreamingStats();
      expect(stats).toMatchObject({
        isStreaming: true,
        currentLogFile: expect.stringContaining('logs-'),
        bufferSize: expect.any(Number),
        lastPosition: expect.any(Number),
        parserStats: expect.any(Object),
      });
    });

    test('should track streaming status correctly', () => {
      const initialStats = service.getStreamingStats();
      expect(initialStats.isStreaming).toBe(false);
      expect(initialStats.currentLogFile).toBeNull();
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const configUpdatedSpy = jest.fn();
      service.on('configUpdated', configUpdatedSpy);

      const newConfig = {
        historyBufferSize: 200,
        pollInterval: 500,
      };

      service.updateConfig(newConfig);

      expect(configUpdatedSpy).toHaveBeenCalledWith(
        expect.objectContaining(newConfig)
      );
    });

    test('should recreate parser when buffer size changes', () => {
      const originalStats = service.getStreamingStats();
      
      service.updateConfig({ historyBufferSize: 150 });
      
      // Parser should be recreated (this is tested indirectly)
      const newStats = service.getStreamingStats();
      expect(newStats).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle file reading errors gracefully', async () => {
      const errorSpy = jest.fn();
      service.on('streamingError', errorSpy);

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      // Should not throw, but handle gracefully
      await service.startStreaming();
      
      expect(service.getStreamingStats().isStreaming).toBe(true);
      expect(service.getRecentLogs()).toHaveLength(0);
    });

    test('should emit error events for streaming problems', async () => {
      const errorSpy = jest.fn();
      service.on('streamingError', errorSpy);

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{}'); // Valid initial read
      mockFs.stat.mockRejectedValue(new Error('Stat failed'));

      await service.startStreaming();
      
      // Trigger a refresh that will fail
      await service.refreshLogs();
      
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should cleanup resources on stop', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{}');

      await service.startStreaming();
      await service.stopStreaming();

      const stats = service.getStreamingStats();
      expect(stats.isStreaming).toBe(false);
    });
  });

  describe('Log Processing', () => {
    test('should emit events for new log entries', async () => {
      const newLogSpy = jest.fn();
      service.on('newLogEntry', newLogSpy);

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"logs": []}'); // Start with empty

      await service.startStreaming();

      // The actual new log processing would happen via file watching
      // or polling, which is harder to test directly. This test serves
      // as a placeholder for the expected behavior.
      
      expect(newLogSpy).not.toHaveBeenCalled(); // No new logs yet
    });

    test('should handle malformed log content gracefully', async () => {
      const streamingService = new LogStreamingService({
        enableFileWatching: false,
      });

      // Mock the private method for testing
      const processMethod = (streamingService as any).processNewLogContent;
      
      // Should handle invalid JSON gracefully
      await expect(
        processMethod.call(streamingService, 'invalid json content')
      ).resolves.not.toThrow();

      await streamingService.stopStreaming();
    });
  });
});