import { ProgressMonitoringService } from '../ProgressMonitoringService';
import { promises as fs } from 'fs';
import path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe('ProgressMonitoringService', () => {
  let service: ProgressMonitoringService;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    service = new ProgressMonitoringService({
      storageDirectory: './test-progress',
      updateInterval: 100,
      maxProgressHistory: 10,
      enablePersistence: false, // Disable for most tests
    });

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    // Clean up any active operations
    const activeOps = service.getActiveOperations();
    for (const op of activeOps) {
      await service.stopMonitoring(op.operationId, 'cancelled');
    }

    service.removeAllListeners();
    jest.useRealTimers();
  });

  describe('Operation Monitoring', () => {
    test('should start monitoring a new operation', async () => {
      const startedSpy = jest.fn();
      service.on('monitoringStarted', startedSpy);

      await service.startMonitoring('op123', 'full_run');

      expect(startedSpy).toHaveBeenCalledWith({
        operationId: 'op123',
        operationType: 'full_run',
      });

      const operation = service.getOperationProgress('op123');
      expect(operation).toBeDefined();
      expect(operation?.status).toBe('running');
      expect(operation?.progress).toBe(0);
    });

    test('should not allow duplicate operation monitoring', async () => {
      await service.startMonitoring('op123', 'full_run');

      await expect(
        service.startMonitoring('op123', 'full_run')
      ).rejects.toThrow('Operation op123 is already being monitored');
    });

    test('should stop monitoring and update status', async () => {
      const stoppedSpy = jest.fn();
      service.on('monitoringStopped', stoppedSpy);

      await service.startMonitoring('op123', 'full_run');
      await service.stopMonitoring('op123', 'completed');

      expect(stoppedSpy).toHaveBeenCalledWith({
        operationId: 'op123',
        status: 'completed',
      });

      const operation = service.getOperationProgress('op123');
      expect(operation).toBeUndefined();

      const history = service.getProgressHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.status).toBe('completed');
      expect(history[0]?.progress).toBe(100);
    });

    test('should handle multiple active operations', async () => {
      await service.startMonitoring('op1', 'full_run');
      await service.startMonitoring('op2', 'collections_only');
      await service.startMonitoring('op3', 'library_only');

      const activeOps = service.getActiveOperations();
      expect(activeOps).toHaveLength(3);
      expect(activeOps.map((op) => op.operationId)).toEqual([
        'op1',
        'op2',
        'op3',
      ]);
    });
  });

  describe('Progress Parsing', () => {
    beforeEach(async () => {
      await service.startMonitoring('op123', 'full_run');
    });

    test('should parse collection processing logs', () => {
      const updateSpy = jest.fn();
      service.on('progressUpdate', updateSpy);

      service.processLogLine('op123', 'Processing collection: Action Movies');

      const operation = service.getOperationProgress('op123');
      expect(operation?.collections).toHaveLength(1);
      expect(operation?.collections[0]).toMatchObject({
        name: 'Action Movies',
        status: 'running',
        type: 'collection',
      });
      expect(operation?.stats.totalCollections).toBe(1);
    });

    test('should parse collection completion logs', () => {
      service.processLogLine('op123', 'Processing collection: Action Movies');
      service.processLogLine('op123', "Collection 'Action Movies' completed");

      const operation = service.getOperationProgress('op123');
      expect(operation?.collections[0]).toMatchObject({
        name: 'Action Movies',
        status: 'completed',
        progress: 100,
      });
      expect(operation?.stats.processedCollections).toBe(1);
    });

    test('should parse library scanning logs', () => {
      service.processLogLine('op123', 'Scanning library: TV Shows (50/100)');

      const operation = service.getOperationProgress('op123');
      expect(operation?.libraries).toHaveLength(1);
      expect(operation?.libraries[0]).toMatchObject({
        name: 'TV Shows',
        status: 'running',
        processedItems: 50,
        totalItems: 100,
        progress: 50,
      });
    });

    test('should parse overall progress logs', () => {
      service.processLogLine('op123', 'Progress: 75%');

      const operation = service.getOperationProgress('op123');
      expect(operation?.progress).toBe(75);
    });

    test('should parse metadata processing logs', () => {
      service.processLogLine('op123', 'Processing item 25 of 100');

      const operation = service.getOperationProgress('op123');
      expect(operation?.stats.processedItems).toBe(25);
      expect(operation?.stats.totalItems).toBe(100);
    });

    test('should parse failure logs', () => {
      service.processLogLine('op123', 'Failed to process collection: Drama');

      const operation = service.getOperationProgress('op123');
      const failedCollection = operation?.collections.find(
        (c) => c.name === 'Drama'
      );
      expect(failedCollection?.status).toBe('failed');
      expect(operation?.stats.errors).toBe(1);
    });
  });

  describe('Phase Management', () => {
    beforeEach(async () => {
      await service.startMonitoring('op123', 'full_run');
    });

    test('should update phases based on progress', () => {
      const operation = service.getOperationProgress('op123');
      expect(operation?.currentPhase).toBe('initializing');

      // Library scan should update phase
      service.processLogLine('op123', 'Scanning library: Movies');
      expect(service.getOperationProgress('op123')?.currentPhase).toBe(
        'library_scan'
      );

      // Collection processing should update phase
      service.processLogLine('op123', 'Processing collection: Action');
      expect(service.getOperationProgress('op123')?.currentPhase).toBe(
        'collection_processing'
      );
    });

    test('should mark previous phases as completed', () => {
      service.processLogLine('op123', 'Scanning library: Movies');
      service.processLogLine('op123', 'Processing collection: Action');

      const operation = service.getOperationProgress('op123');
      const initPhase = operation?.phases.find(
        (p) => p.name === 'initialization'
      );
      const scanPhase = operation?.phases.find(
        (p) => p.name === 'library_scan'
      );

      expect(initPhase?.status).toBe('completed');
      expect(initPhase?.progress).toBe(100);
      expect(scanPhase?.status).toBe('completed');
    });
  });

  describe('Progress Calculations', () => {
    beforeEach(async () => {
      await service.startMonitoring('op123', 'full_run');
    });

    test('should calculate estimated time remaining', () => {
      const operation = service.getOperationProgress('op123');
      if (operation) {
        operation.progress = 50;
        operation.startTime = new Date(Date.now() - 60000); // 1 minute ago
      }

      const remaining = service.getEstimatedTimeRemaining('op123');
      expect(remaining).toBeCloseTo(60000, -3); // Approximately 1 minute
    });

    test('should return undefined for zero progress', () => {
      const remaining = service.getEstimatedTimeRemaining('op123');
      expect(remaining).toBeUndefined();
    });

    test('should update progress based on processed items', () => {
      const updateSpy = jest.fn();
      service.on('progressUpdate', updateSpy);

      // Process some collections
      service.processLogLine('op123', 'Processing collection: Action');
      service.processLogLine('op123', "Collection 'Action' completed");
      service.processLogLine('op123', 'Processing collection: Comedy');
      service.processLogLine('op123', "Collection 'Comedy' completed");

      // Trigger update timer
      jest.advanceTimersByTime(100);

      expect(updateSpy).toHaveBeenCalled();
      const lastCall = updateSpy.mock.calls[updateSpy.mock.calls.length - 1];
      expect(lastCall[0].progress).toBeGreaterThan(0);
    });
  });

  describe('Operation Cancellation', () => {
    test('should cancel running operation', async () => {
      const cancellationSpy = jest.fn();
      service.on('cancellationRequested', cancellationSpy);

      await service.startMonitoring('op123', 'full_run');
      await service.cancelOperation('op123');

      expect(cancellationSpy).toHaveBeenCalledWith({ operationId: 'op123' });

      const history = service.getProgressHistory();
      expect(history[0]?.status).toBe('cancelled');
    });

    test('should not cancel non-running operation', async () => {
      await service.startMonitoring('op123', 'full_run');
      await service.stopMonitoring('op123', 'completed');

      await expect(service.cancelOperation('op123')).rejects.toThrow(
        'Operation op123 not found'
      );
    });
  });

  describe('History Management', () => {
    test('should maintain history size limit', async () => {
      // Create more operations than the limit
      for (let i = 0; i < 15; i++) {
        await service.startMonitoring(`op${i}`, 'full_run');
        await service.stopMonitoring(`op${i}`, 'completed');
      }

      const history = service.getProgressHistory();
      expect(history).toHaveLength(10); // maxProgressHistory
    });

    test('should load history from storage', async () => {
      const persistentService = new ProgressMonitoringService({
        enablePersistence: true,
      });

      const mockHistory = [
        {
          operationId: 'op1',
          status: 'completed',
          startTime: '2023-01-01T00:00:00.000Z',
          endTime: '2023-01-01T01:00:00.000Z',
          progress: 100,
        },
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockHistory));

      await persistentService.loadProgressHistory();

      const history = persistentService.getProgressHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.operationId).toBe('op1');
    });
  });

  describe('Statistics', () => {
    test('should provide monitoring statistics', async () => {
      await service.startMonitoring('op1', 'full_run');
      await service.startMonitoring('op2', 'full_run');
      await service.stopMonitoring('op1', 'completed');

      const stats = service.getMonitoringStats();
      expect(stats).toMatchObject({
        isMonitoring: true,
        activeOperations: 1,
        totalHistorySize: 1,
        successRate: 100,
      });
    });

    test('should calculate average operation duration', async () => {
      await service.startMonitoring('op1', 'full_run');

      // Simulate time passing
      jest.advanceTimersByTime(60000); // 1 minute

      await service.stopMonitoring('op1', 'completed');

      const stats = service.getMonitoringStats();
      expect(stats.averageOperationDuration).toBeGreaterThan(0);
    });
  });

  describe('Persistence', () => {
    test('should persist operation progress', async () => {
      const persistentService = new ProgressMonitoringService({
        enablePersistence: true,
        storageDirectory: './test-progress',
      });

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await persistentService.startMonitoring('op123', 'full_run');

      expect(mockFs.mkdir).toHaveBeenCalledWith('./test-progress', {
        recursive: true,
      });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join('./test-progress', 'progress-op123.json'),
        expect.any(String)
      );

      await persistentService.stopMonitoring('op123');
    });

    test('should handle persistence errors gracefully', async () => {
      const persistentService = new ProgressMonitoringService({
        enablePersistence: true,
      });

      const errorSpy = jest.fn();
      persistentService.on('persistenceError', errorSpy);

      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await persistentService.startMonitoring('op123', 'full_run');

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Update Timer', () => {
    test('should emit periodic progress updates', async () => {
      const updateSpy = jest.fn();
      service.on('progressUpdate', updateSpy);

      await service.startMonitoring('op123', 'full_run');

      // Process some data
      service.processLogLine('op123', 'Processing collection: Action');

      // Advance timer
      jest.advanceTimersByTime(100);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'op123',
          progress: expect.any(Number),
          currentPhase: expect.any(String),
          stats: expect.any(Object),
        })
      );
    });

    test('should stop timer when no active operations', async () => {
      await service.startMonitoring('op123', 'full_run');

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await service.stopMonitoring('op123');

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
