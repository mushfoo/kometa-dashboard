import { EventEmitter } from 'events';

// Polling configuration interface
export interface PollingConfig {
  enabled: boolean;
  interval: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  backoffMultiplier?: number;
  maxBackoffDelay?: number; // milliseconds
  // eslint-disable-next-line no-unused-vars
  onError?: (error: Error, retryCount: number) => void;
}

// Poll result interface
export interface PollResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  timestamp: Date;
  duration: number; // milliseconds
}

// Default polling configuration
const DEFAULT_CONFIG: Required<PollingConfig> = {
  enabled: true,
  interval: 5000, // 5 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  backoffMultiplier: 2,
  maxBackoffDelay: 30000, // 30 seconds
  onError: (error: Error, retryCount: number) => {
    console.warn(`Polling error (retry ${retryCount}):`, error.message);
  },
};

/**
 * Smart polling service with configurable intervals, error handling,
 * and automatic backoff strategies for efficient real-time updates.
 */
export class PollingService<T = unknown> extends EventEmitter {
  protected config: Required<PollingConfig>;
  private pollCallback: () => Promise<T>;
  private isPolling = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private currentBackoffDelay = 0;
  private lastPollTime: Date | null = null;
  private pollHistory: PollResult<T>[] = [];
  private readonly maxHistorySize = 100;

  constructor(
    pollCallback: () => Promise<T>,
    config: Partial<PollingConfig> = {}
  ) {
    super();
    this.pollCallback = pollCallback;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentBackoffDelay = this.config.retryDelay;
    this.setMaxListeners(50); // Support many listeners
  }

  /**
   * Start polling with the configured interval
   */
  start(): void {
    if (this.isPolling) {
      return;
    }

    if (!this.config.enabled) {
      this.emit('disabled');
      return;
    }

    this.isPolling = true;
    this.retryCount = 0;
    this.currentBackoffDelay = this.config.retryDelay;

    this.emit('started');
    this.schedulePoll();
  }

  /**
   * Stop polling and clear any pending timeouts
   */
  stop(): void {
    if (!this.isPolling) {
      return;
    }

    this.isPolling = false;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.emit('stopped');
  }

  /**
   * Perform a single poll immediately
   */
  async poll(): Promise<PollResult<T>> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      const data = await this.pollCallback();
      const duration = Date.now() - startTime;

      const result: PollResult<T> = {
        success: true,
        data,
        timestamp,
        duration,
      };

      this.handlePollSuccess(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: PollResult<T> = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp,
        duration,
      };

      this.handlePollError(result);
      return result;
    }
  }

  /**
   * Update polling configuration
   */
  updateConfig(newConfig: Partial<PollingConfig>): void {
    const wasPolling = this.isPolling;

    if (wasPolling) {
      this.stop();
    }

    this.config = { ...this.config, ...newConfig };
    this.currentBackoffDelay = this.config.retryDelay;

    if (wasPolling && this.config.enabled) {
      this.start();
    }

    this.emit('configUpdated', this.config);
  }

  /**
   * Get current polling status
   */
  getStatus(): {
    isPolling: boolean;
    enabled: boolean;
    interval: number;
    retryCount: number;
    currentBackoffDelay: number;
    lastPollTime: Date | null;
    nextPollTime: Date | null;
  } {
    const nextPollTime =
      this.isPolling && this.timeoutId
        ? new Date(
            Date.now() +
              (this.retryCount > 0
                ? this.currentBackoffDelay
                : this.config.interval)
          )
        : null;

    return {
      isPolling: this.isPolling,
      enabled: this.config.enabled,
      interval: this.config.interval,
      retryCount: this.retryCount,
      currentBackoffDelay: this.currentBackoffDelay,
      lastPollTime: this.lastPollTime,
      nextPollTime,
    };
  }

  /**
   * Get polling statistics
   */
  getStatistics(): {
    totalPolls: number;
    successfulPolls: number;
    failedPolls: number;
    successRate: number;
    averageDuration: number;
    recentResults: PollResult<T>[];
  } {
    const totalPolls = this.pollHistory.length;
    const successfulPolls = this.pollHistory.filter((r) => r.success).length;
    const failedPolls = totalPolls - successfulPolls;
    const successRate =
      totalPolls > 0 ? (successfulPolls / totalPolls) * 100 : 0;

    const averageDuration =
      totalPolls > 0
        ? this.pollHistory.reduce((sum, r) => sum + r.duration, 0) / totalPolls
        : 0;

    return {
      totalPolls,
      successfulPolls,
      failedPolls,
      successRate,
      averageDuration,
      recentResults: [...this.pollHistory].slice(-10), // Last 10 results
    };
  }

  /**
   * Clear polling history
   */
  clearHistory(): void {
    this.pollHistory = [];
    this.emit('historyCleared');
  }

  /**
   * Check if polling is healthy (recent success rate > threshold)
   */
  isHealthy(successRateThreshold = 80): boolean {
    const recentResults = this.pollHistory.slice(-10);
    if (recentResults.length === 0) return true;

    const recentSuccesses = recentResults.filter((r) => r.success).length;
    const recentSuccessRate = (recentSuccesses / recentResults.length) * 100;

    return recentSuccessRate >= successRateThreshold;
  }

  /**
   * Schedule the next poll
   */
  private schedulePoll(): void {
    if (!this.isPolling) {
      return;
    }

    const delay =
      this.retryCount > 0 ? this.currentBackoffDelay : this.config.interval;

    this.timeoutId = setTimeout(async () => {
      if (this.isPolling) {
        await this.poll();
        this.schedulePoll();
      }
    }, delay);
  }

  /**
   * Handle successful poll result
   */
  private handlePollSuccess(result: PollResult<T>): void {
    this.lastPollTime = result.timestamp;
    this.retryCount = 0;
    this.currentBackoffDelay = this.config.retryDelay;

    this.addToHistory(result);
    this.emit('poll', result);
    this.emit('success', result);
  }

  /**
   * Handle failed poll result
   */
  private handlePollError(result: PollResult<T>): void {
    this.lastPollTime = result.timestamp;
    this.retryCount++;

    this.addToHistory(result);
    this.emit('poll', result);
    this.emit('error', result);

    // Notify error handler
    this.config.onError(result.error!, this.retryCount);

    // Calculate next backoff delay
    if (this.retryCount <= this.config.maxRetries) {
      this.currentBackoffDelay = Math.min(
        this.currentBackoffDelay * this.config.backoffMultiplier,
        this.config.maxBackoffDelay
      );
    } else {
      // Max retries exceeded - stop polling temporarily
      this.stop();
      this.emit('maxRetriesExceeded', {
        retryCount: this.retryCount,
        lastError: result.error,
      });
    }
  }

  /**
   * Add result to history with size limit
   */
  private addToHistory(result: PollResult<T>): void {
    this.pollHistory.push(result);

    if (this.pollHistory.length > this.maxHistorySize) {
      this.pollHistory.shift();
    }
  }
}

/**
 * Create a smart polling service with optimized defaults for different use cases
 */
export function createPollingService<T>(
  pollCallback: () => Promise<T>,
  options: {
    type?: 'frequent' | 'moderate' | 'infrequent';
    customConfig?: Partial<PollingConfig>;
  } = {}
): PollingService<T> {
  const { type = 'moderate', customConfig = {} } = options;

  let baseConfig: Partial<PollingConfig>;

  switch (type) {
    case 'frequent':
      baseConfig = {
        interval: 2000, // 2 seconds
        maxRetries: 5,
        retryDelay: 500, // 0.5 seconds
        backoffMultiplier: 1.5,
        maxBackoffDelay: 10000, // 10 seconds
      };
      break;
    case 'infrequent':
      baseConfig = {
        interval: 30000, // 30 seconds
        maxRetries: 2,
        retryDelay: 5000, // 5 seconds
        backoffMultiplier: 3,
        maxBackoffDelay: 60000, // 1 minute
      };
      break;
    default: // moderate
      baseConfig = {
        interval: 5000, // 5 seconds
        maxRetries: 3,
        retryDelay: 1000, // 1 second
        backoffMultiplier: 2,
        maxBackoffDelay: 30000, // 30 seconds
      };
  }

  return new PollingService(pollCallback, { ...baseConfig, ...customConfig });
}

/**
 * Adaptive polling service that adjusts interval based on data change frequency
 */
export class AdaptivePollingService<T> extends PollingService<T> {
  private lastDataHash: string | null = null;
  private unchangedCount = 0;
  private readonly baseInterval: number;
  private readonly maxInterval: number;
  private readonly minInterval: number;

  constructor(
    pollCallback: () => Promise<T>,
    config: Partial<PollingConfig> & {
      minInterval?: number;
      maxInterval?: number;
      adaptiveThreshold?: number;
    } = {}
  ) {
    const {
      minInterval = 1000,
      maxInterval = 60000,
      adaptiveThreshold = 5,
      ...baseConfig
    } = config;

    super(pollCallback, baseConfig);

    this.baseInterval = baseConfig.interval || DEFAULT_CONFIG.interval;
    this.minInterval = minInterval;
    this.maxInterval = maxInterval;

    // Listen to our own poll events to adapt interval
    this.on('success', (result: PollResult<T>) => {
      if (result.data !== undefined) {
        this.adaptInterval(result.data, adaptiveThreshold);
      }
    });
  }

  /**
   * Adapt polling interval based on data changes
   */
  private adaptInterval(data: T, threshold: number): void {
    const currentHash = this.hashData(data);

    if (this.lastDataHash === currentHash) {
      this.unchangedCount++;
    } else {
      this.unchangedCount = 0;
      this.lastDataHash = currentHash;
    }

    // Adjust interval based on data change frequency
    let newInterval: number;

    if (this.unchangedCount === 0) {
      // Data changed - use base interval
      newInterval = this.baseInterval;
    } else if (this.unchangedCount >= threshold) {
      // Data hasn't changed for a while - slow down
      newInterval = Math.min(this.baseInterval * 2, this.maxInterval);
    } else {
      // Gradual slowdown
      const multiplier = 1 + this.unchangedCount / threshold;
      newInterval = Math.min(this.baseInterval * multiplier, this.maxInterval);
    }

    // Ensure we don't go below minimum
    newInterval = Math.max(newInterval, this.minInterval);

    // Update config if interval changed significantly
    if (Math.abs(newInterval - this.config.interval) > 1000) {
      this.updateConfig({ interval: newInterval });
      this.emit('intervalAdapted', {
        oldInterval: this.config.interval,
        newInterval,
        unchangedCount: this.unchangedCount,
      });
    }
  }

  /**
   * Create a simple hash of the data for comparison
   */
  private hashData(data: T): string {
    try {
      return JSON.stringify(data);
    } catch {
      // Fallback for non-serializable data
      return String(data);
    }
  }
}
