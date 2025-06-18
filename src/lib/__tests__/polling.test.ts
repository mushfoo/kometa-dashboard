import {
  PollingService,
  AdaptivePollingService,
  createPollingService,
} from '../polling';
// import { PollingConfig } from '../polling';

// Mock timers for testing
jest.useFakeTimers();

describe('PollingService', () => {
  let mockCallback: jest.MockedFunction<() => Promise<string>>;
  let service: PollingService<string>;

  beforeEach(() => {
    mockCallback = jest.fn();
    service = new PollingService(mockCallback, {
      interval: 1000,
      enabled: true,
      maxRetries: 2,
      retryDelay: 500,
    });

    // Suppress error events to prevent unhandled error exceptions in tests
    service.on('error', () => {});
  });

  afterEach(() => {
    service.stop();
    service.removeAllListeners();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Basic Polling Functionality', () => {
    test('should start and stop polling', () => {
      const startedSpy = jest.fn();
      const stoppedSpy = jest.fn();

      service.on('started', startedSpy);
      service.on('stopped', stoppedSpy);

      expect(service.getStatus().isPolling).toBe(false);

      service.start();
      expect(service.getStatus().isPolling).toBe(true);
      expect(startedSpy).toHaveBeenCalledTimes(1);

      service.stop();
      expect(service.getStatus().isPolling).toBe(false);
      expect(stoppedSpy).toHaveBeenCalledTimes(1);
    });

    test('should not start if already polling', () => {
      const startedSpy = jest.fn();
      service.on('started', startedSpy);

      service.start();
      service.start(); // Second call should be ignored

      expect(startedSpy).toHaveBeenCalledTimes(1);
    });

    test('should not start if disabled', () => {
      const disabledSpy = jest.fn();
      service.on('disabled', disabledSpy);

      service.updateConfig({ enabled: false });
      service.start();

      expect(service.getStatus().isPolling).toBe(false);
      expect(disabledSpy).toHaveBeenCalledTimes(1);
    });

    test('should perform immediate poll', async () => {
      mockCallback.mockResolvedValue('test data');

      const result = await service.poll();

      expect(result.success).toBe(true);
      expect(result.data).toBe('test data');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    test('should handle poll errors', async () => {
      const error = new Error('Poll failed');
      mockCallback.mockRejectedValue(error);

      // Mock console.warn to silence expected error logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await service.poll();

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.data).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe('Scheduled Polling', () => {
    test('should poll at configured intervals', async () => {
      mockCallback.mockResolvedValue('data');

      service.start();

      // First poll after initial interval
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockCallback).toHaveBeenCalledTimes(1);

      // Next poll after interval
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockCallback).toHaveBeenCalledTimes(2);

      // Another poll
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });

    test('should emit success events on successful polls', async () => {
      const successSpy = jest.fn();
      const pollSpy = jest.fn();

      service.on('success', successSpy);
      service.on('poll', pollSpy);

      mockCallback.mockResolvedValue('success data');
      service.start();

      await jest.advanceTimersByTimeAsync(1000);

      expect(successSpy).toHaveBeenCalledTimes(1);
      expect(pollSpy).toHaveBeenCalledTimes(1);
      expect(successSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: 'success data',
        })
      );
    });

    test('should emit error events on failed polls', async () => {
      const errorSpy = jest.fn();
      const error = new Error('Test error');

      // Remove the automatic error handler and add our spy
      service.removeAllListeners('error');
      service.on('error', errorSpy);

      // Mock console.warn to silence expected error logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockCallback.mockRejectedValue(error);

      service.start();
      await jest.advanceTimersByTimeAsync(1000);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error,
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling and Retries', () => {
    test('should handle retry logic on poll failures', async () => {
      const error = new Error('Test error');
      mockCallback.mockRejectedValue(error);

      // Mock console.warn to silence expected error logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Test individual poll with retry behavior
      const result = await service.poll();
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(service.getStatus().retryCount).toBe(1);

      consoleSpy.mockRestore();
    });

    test('should track max retries in status', async () => {
      const error = new Error('Persistent error');
      mockCallback.mockRejectedValue(error);

      // Mock console.warn to silence expected error logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Simulate multiple failures to reach max retries
      await service.poll(); // First failure
      await service.poll(); // Second failure
      await service.poll(); // Third failure (exceeds maxRetries=2)

      expect(service.getStatus().retryCount).toBe(3);

      consoleSpy.mockRestore();
    });

    test('should reset retry count on successful poll', async () => {
      // Mock console.warn to silence expected error logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockCallback.mockRejectedValueOnce(new Error('Temporary error'));

      // First poll fails
      await service.poll();
      expect(service.getStatus().retryCount).toBe(1);

      // Next poll succeeds
      mockCallback.mockResolvedValue('success');
      await service.poll();
      expect(service.getStatus().retryCount).toBe(0);

      consoleSpy.mockRestore();
    });

    test('should call error handler on failures', async () => {
      const errorHandler = jest.fn();
      const serviceWithHandler = new PollingService(mockCallback, {
        interval: 1000,
        onError: errorHandler,
      });
      // Suppress error events for this service too
      serviceWithHandler.on('error', () => {});

      // Mock console.warn to silence expected error logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const error = new Error('Test error');
      mockCallback.mockRejectedValue(error);

      await serviceWithHandler.poll();

      expect(errorHandler).toHaveBeenCalledWith(error, 1);

      consoleSpy.mockRestore();
      serviceWithHandler.stop();
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const configUpdatedSpy = jest.fn();
      service.on('configUpdated', configUpdatedSpy);

      const newConfig = { interval: 2000, maxRetries: 5 };
      service.updateConfig(newConfig);

      expect(service.getStatus().interval).toBe(2000);
      expect(configUpdatedSpy).toHaveBeenCalledWith(
        expect.objectContaining(newConfig)
      );
    });

    test('should restart polling when config changes if already polling', () => {
      const stoppedSpy = jest.fn();
      const startedSpy = jest.fn();

      service.on('stopped', stoppedSpy);
      service.on('started', startedSpy);

      service.start();
      expect(startedSpy).toHaveBeenCalledTimes(1);

      service.updateConfig({ interval: 2000 });

      expect(stoppedSpy).toHaveBeenCalledTimes(1);
      expect(startedSpy).toHaveBeenCalledTimes(2);
    });

    test('should not restart if not currently polling', () => {
      const startedSpy = jest.fn();
      service.on('started', startedSpy);

      service.updateConfig({ interval: 2000 });

      expect(service.getStatus().isPolling).toBe(false);
      expect(startedSpy).not.toHaveBeenCalled();
    });
  });

  describe('Statistics and History', () => {
    test('should track polling statistics', async () => {
      // Mock console.warn to silence expected error logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockCallback
        .mockResolvedValueOnce('success1')
        .mockRejectedValueOnce(new Error('error1'))
        .mockResolvedValueOnce('success2');

      // Perform individual polls
      await service.poll();
      await service.poll();
      await service.poll();

      const stats = service.getStatistics();
      expect(stats.totalPolls).toBe(3);
      expect(stats.successfulPolls).toBe(2);
      expect(stats.failedPolls).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
      expect(stats.averageDuration).toBeGreaterThanOrEqual(0);
      expect(stats.recentResults).toHaveLength(3);

      consoleSpy.mockRestore();
    });

    test('should maintain limited history', async () => {
      const smallHistoryService = new PollingService(mockCallback, {
        interval: 100,
      });
      // Mock the maxHistorySize to be smaller for testing
      (smallHistoryService as any).maxHistorySize = 3;

      mockCallback.mockResolvedValue('data');

      // Perform more polls than history size
      for (let i = 0; i < 5; i++) {
        await smallHistoryService.poll();
      }

      const stats = smallHistoryService.getStatistics();
      expect(stats.recentResults).toHaveLength(3); // Limited by maxHistorySize
    });

    test('should clear history', async () => {
      mockCallback.mockResolvedValue('data');
      await service.poll();

      expect(service.getStatistics().totalPolls).toBe(1);

      service.clearHistory();
      expect(service.getStatistics().totalPolls).toBe(0);
    });

    test('should check health status', async () => {
      // All successful polls
      mockCallback.mockResolvedValue('data');
      for (let i = 0; i < 5; i++) {
        await service.poll();
      }
      expect(service.isHealthy()).toBe(true);

      // Mock console.warn to silence expected error logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Add some failures
      mockCallback.mockRejectedValue(new Error('error'));
      for (let i = 0; i < 8; i++) {
        await service.poll();
      }
      expect(service.isHealthy(80)).toBe(false); // 5 success / 13 total = ~38%

      consoleSpy.mockRestore();
    });
  });

  describe('Status Information', () => {
    test('should provide comprehensive status', () => {
      const status = service.getStatus();

      expect(status).toEqual({
        isPolling: false,
        enabled: true,
        interval: 1000,
        retryCount: 0,
        currentBackoffDelay: 500,
        lastPollTime: null,
        nextPollTime: null,
      });
    });

    test('should calculate next poll time when polling', () => {
      service.start();
      const status = service.getStatus();

      expect(status.isPolling).toBe(true);
      expect(status.nextPollTime).toBeInstanceOf(Date);
    });
  });
});

describe('createPollingService', () => {
  test('should create service with frequent polling defaults', () => {
    const callback = jest.fn().mockResolvedValue('data');
    const service = createPollingService(callback, { type: 'frequent' });

    expect(service.getStatus().interval).toBe(2000);
  });

  test('should create service with infrequent polling defaults', () => {
    const callback = jest.fn().mockResolvedValue('data');
    const service = createPollingService(callback, { type: 'infrequent' });

    expect(service.getStatus().interval).toBe(30000);
  });

  test('should allow custom config override', () => {
    const callback = jest.fn().mockResolvedValue('data');
    const service = createPollingService(callback, {
      type: 'moderate',
      customConfig: { interval: 8000 },
    });

    expect(service.getStatus().interval).toBe(8000);
  });
});

describe('AdaptivePollingService', () => {
  let mockCallback: jest.MockedFunction<() => Promise<{ value: number }>>;
  let adaptiveService: AdaptivePollingService<{ value: number }>;

  beforeEach(() => {
    mockCallback = jest.fn();
    adaptiveService = new AdaptivePollingService(mockCallback, {
      interval: 5000,
      minInterval: 1000,
      maxInterval: 30000,
    });
  });

  afterEach(() => {
    adaptiveService.stop();
    adaptiveService.removeAllListeners();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  test('should maintain base interval when data changes', async () => {
    mockCallback
      .mockResolvedValueOnce({ value: 1 })
      .mockResolvedValueOnce({ value: 2 })
      .mockResolvedValueOnce({ value: 3 });

    await adaptiveService.poll(); // value: 1
    await adaptiveService.poll(); // value: 2 (changed)

    expect(adaptiveService.getStatus().interval).toBe(5000); // Base interval maintained
  });

  test('should slow down when data stops changing', async () => {
    const intervalAdaptedSpy = jest.fn();
    adaptiveService.on('intervalAdapted', intervalAdaptedSpy);

    // Same data multiple times
    mockCallback.mockResolvedValue({ value: 42 });

    // Poll multiple times with same data
    for (let i = 0; i < 6; i++) {
      await adaptiveService.poll();
    }

    // Should have adapted interval after threshold reached
    expect(intervalAdaptedSpy).toHaveBeenCalled();
    expect(adaptiveService.getStatus().interval).toBeGreaterThan(5000);
  });

  test('should reset interval when data changes again', async () => {
    mockCallback.mockResolvedValue({ value: 42 });

    // Build up unchanged count
    for (let i = 0; i < 6; i++) {
      await adaptiveService.poll();
    }

    const slowInterval = adaptiveService.getStatus().interval;
    expect(slowInterval).toBeGreaterThan(5000);

    // Data changes
    mockCallback.mockResolvedValue({ value: 999 });
    await adaptiveService.poll();

    // Should reset to base interval
    expect(adaptiveService.getStatus().interval).toBeLessThanOrEqual(5000);
  });

  test('should respect min and max interval limits', async () => {
    const extremeAdaptiveService = new AdaptivePollingService(mockCallback, {
      interval: 1000,
      minInterval: 500,
      maxInterval: 2000,
    });

    mockCallback.mockResolvedValue({ value: 42 });

    // Build up unchanged count to force max interval
    for (let i = 0; i < 20; i++) {
      await extremeAdaptiveService.poll();
    }

    const finalInterval = extremeAdaptiveService.getStatus().interval;
    expect(finalInterval).toBeLessThanOrEqual(2000); // Respects max
    expect(finalInterval).toBeGreaterThanOrEqual(500); // Respects min

    extremeAdaptiveService.stop();
  });
});
