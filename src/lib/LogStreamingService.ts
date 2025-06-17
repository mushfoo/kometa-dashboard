import { EventEmitter } from 'events';
import { LogParser, ParsedLogEntry, LogFilter } from './LogParser';
import { promises as fs, watch, FSWatcher } from 'fs';
import path from 'path';

// Log streaming configuration
export interface LogStreamConfig {
  logDirectory: string;
  historyBufferSize: number;
  pollInterval: number;
  enableFileWatching: boolean;
}

// Default configuration
const DEFAULT_CONFIG: LogStreamConfig = {
  logDirectory: './storage/history',
  historyBufferSize: 100,
  pollInterval: 1000, // 1 second
  enableFileWatching: true,
};

/**
 * LogStreamingService provides real-time log streaming with file watching,
 * history buffering, and efficient filtering capabilities.
 */
export class LogStreamingService extends EventEmitter {
  private config: LogStreamConfig;
  private parser: LogParser;
  private isStreaming = false;
  private currentLogFile: string | null = null;
  private fileWatcher: FSWatcher | null = null;
  private lastPosition = 0;
  private pollInterval: NodeJS.Timeout | null = null;
  private historyBuffer: ParsedLogEntry[] = [];

  constructor(config: Partial<LogStreamConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parser = new LogParser(this.config.historyBufferSize);
    this.setMaxListeners(50);

    // Forward parser events
    this.parser.on('logEntry', (entry) => this.emit('logEntry', entry));
    this.parser.on('error', (entry) => this.emit('error', entry));
    this.parser.on('warning', (entry) => this.emit('warning', entry));
  }

  /**
   * Start log streaming from the current month's log file
   */
  async startStreaming(operationId?: string): Promise<void> {
    if (this.isStreaming) {
      return;
    }

    this.isStreaming = true;
    this.currentLogFile = this.getCurrentLogFile();

    try {
      // Ensure log directory exists
      await fs.mkdir(path.dirname(this.currentLogFile), { recursive: true });

      // Load initial history buffer
      await this.loadHistoryBuffer();

      // Start file watching if enabled
      if (this.config.enableFileWatching) {
        await this.startFileWatching();
      } else {
        await this.startPolling();
      }

      this.emit('streamingStarted', {
        logFile: this.currentLogFile,
        operationId,
        bufferSize: this.historyBuffer.length,
      });
    } catch (error) {
      this.isStreaming = false;
      throw error;
    }
  }

  /**
   * Stop log streaming and cleanup resources
   */
  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) {
      return;
    }

    this.isStreaming = false;

    // Cleanup file watcher
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }

    // Cleanup polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.emit('streamingStopped');
  }

  /**
   * Get filtered logs from history buffer
   */
  getFilteredLogs(filter: LogFilter): ParsedLogEntry[] {
    return this.parser.getFilteredLogs(filter);
  }

  /**
   * Get recent logs from history buffer
   */
  getRecentLogs(count: number = 100): ParsedLogEntry[] {
    return this.historyBuffer.slice(-count);
  }

  /**
   * Search logs in history buffer
   */
  searchLogs(
    pattern: string | RegExp,
    options: {
      caseSensitive?: boolean;
      maxResults?: number;
    } = {}
  ): ParsedLogEntry[] {
    return this.parser.searchLogs(pattern, options);
  }

  /**
   * Get streaming statistics
   */
  getStreamingStats(): {
    isStreaming: boolean;
    currentLogFile: string | null;
    bufferSize: number;
    lastPosition: number;
    parserStats: ReturnType<LogParser['getBufferStats']>;
  } {
    return {
      isStreaming: this.isStreaming,
      currentLogFile: this.currentLogFile,
      bufferSize: this.historyBuffer.length,
      lastPosition: this.lastPosition,
      parserStats: this.parser.getBufferStats(),
    };
  }

  /**
   * Force refresh of log content
   */
  async refreshLogs(): Promise<void> {
    if (!this.isStreaming || !this.currentLogFile) {
      return;
    }

    try {
      await this.readNewLogContent();
    } catch (error) {
      this.emit('streamingError', error);
    }
  }

  /**
   * Get current log file path based on current month
   */
  private getCurrentLogFile(): string {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    return path.join(this.config.logDirectory, `logs-${currentMonth}.json`);
  }

  /**
   * Load historical log entries into buffer
   */
  private async loadHistoryBuffer(): Promise<void> {
    if (!this.currentLogFile) {
      return;
    }

    try {
      const content = await fs.readFile(this.currentLogFile, 'utf-8');
      const data = JSON.parse(content);

      if (data.logs && Array.isArray(data.logs)) {
        // Add logs to parser and buffer
        this.historyBuffer = data.logs.slice(-this.config.historyBufferSize);

        // Process each log through parser for consistency
        this.historyBuffer.forEach((entry) => {
          this.parser.addLogEntry(entry);
        });
      }

      // Set position to end of file for future reads
      this.lastPosition = content.length;
    } catch (error) {
      // File doesn't exist or is empty - that's okay
      this.historyBuffer = [];
      this.lastPosition = 0;
    }
  }

  /**
   * Start file watching for real-time updates
   */
  private async startFileWatching(): Promise<void> {
    if (!this.currentLogFile) {
      return;
    }

    try {
      // Watch the log file for changes
      this.fileWatcher = watch(
        this.currentLogFile,
        async (eventType: string) => {
          if (eventType === 'change' && this.isStreaming) {
            await this.readNewLogContent();
          }
        }
      );

      // Also watch for log rotation (new file creation)
      const logDir = path.dirname(this.currentLogFile);
      const dirWatcher = watch(
        logDir,
        async (eventType: string, filename: string | null) => {
          if (
            eventType === 'rename' &&
            filename &&
            filename.startsWith('logs-')
          ) {
            await this.handleLogRotation();
          }
        }
      );

      // Store dir watcher reference (could be enhanced to track multiple watchers)
      this.fileWatcher = dirWatcher;
    } catch (error) {
      // Fallback to polling if file watching fails
      console.warn('File watching failed, falling back to polling:', error);
      await this.startPolling();
    }
  }

  /**
   * Start polling for log updates as fallback
   */
  private async startPolling(): Promise<void> {
    this.pollInterval = setInterval(async () => {
      if (this.isStreaming) {
        await this.readNewLogContent();
      }
    }, this.config.pollInterval);
  }

  /**
   * Read new content from log file since last position
   */
  private async readNewLogContent(): Promise<void> {
    if (!this.currentLogFile) {
      return;
    }

    try {
      const stats = await fs.stat(this.currentLogFile);

      // Check if file has grown
      if (stats.size <= this.lastPosition) {
        return;
      }

      // Read new content from last position
      const stream = await fs.open(this.currentLogFile, 'r');
      const buffer = Buffer.alloc(stats.size - this.lastPosition);
      await stream.read(buffer, 0, buffer.length, this.lastPosition);
      await stream.close();

      const newContent = buffer.toString('utf-8');
      this.lastPosition = stats.size;

      // Process new content
      await this.processNewLogContent(newContent);
    } catch (error) {
      // Handle file access errors gracefully
      this.emit('streamingError', error);
    }
  }

  /**
   * Process new log content and extract log entries
   */
  private async processNewLogContent(content: string): Promise<void> {
    if (!content.trim()) {
      return;
    }

    try {
      // For JSON log files, we need to parse the updated structure
      // This is a simplified approach - in practice, you might need
      // more sophisticated incremental JSON parsing

      // For now, re-read the entire file to get the latest logs
      const fullContent = await fs.readFile(this.currentLogFile!, 'utf-8');
      const data = JSON.parse(fullContent);

      if (data.logs && Array.isArray(data.logs)) {
        const currentLogCount = this.historyBuffer.length;
        const newLogs = data.logs.slice(currentLogCount);

        // Process new log entries
        newLogs.forEach((logEntry: any) => {
          // Add to history buffer
          this.historyBuffer.push(logEntry);

          // Maintain buffer size
          if (this.historyBuffer.length > this.config.historyBufferSize) {
            this.historyBuffer.shift();
          }

          // Process through parser
          this.parser.addLogEntry(logEntry);

          // Emit real-time event
          this.emit('newLogEntry', logEntry);
        });
      }
    } catch (error) {
      // If JSON parsing fails, try parsing as line-based logs
      const lines = content.split('\n').filter((line) => line.trim());

      lines.forEach((line) => {
        const entry = this.parser.processLine(line, 'stdout');
        this.historyBuffer.push(entry);

        // Maintain buffer size
        if (this.historyBuffer.length > this.config.historyBufferSize) {
          this.historyBuffer.shift();
        }

        this.emit('newLogEntry', entry);
      });
    }
  }

  /**
   * Handle log file rotation
   */
  private async handleLogRotation(): Promise<void> {
    const newLogFile = this.getCurrentLogFile();

    if (newLogFile !== this.currentLogFile) {
      this.emit('logRotation', {
        oldFile: this.currentLogFile,
        newFile: newLogFile,
      });

      // Switch to new file
      this.currentLogFile = newLogFile;
      this.lastPosition = 0;

      // Restart watching/polling for new file
      if (this.fileWatcher) {
        this.fileWatcher.close();
        this.fileWatcher = null;
      }

      if (this.config.enableFileWatching) {
        await this.startFileWatching();
      }

      // Load buffer from new file
      await this.loadHistoryBuffer();
    }
  }

  /**
   * Update streaming configuration
   */
  updateConfig(newConfig: Partial<LogStreamConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update parser buffer size if changed
    if (
      newConfig.historyBufferSize &&
      newConfig.historyBufferSize !== this.parser['maxBufferSize']
    ) {
      this.parser = new LogParser(newConfig.historyBufferSize);

      // Re-forward events
      this.parser.on('logEntry', (entry) => this.emit('logEntry', entry));
      this.parser.on('error', (entry) => this.emit('error', entry));
      this.parser.on('warning', (entry) => this.emit('warning', entry));
    }

    this.emit('configUpdated', this.config);
  }
}

/**
 * Create a log streaming service with optimized defaults
 */
export function createLogStreamingService(
  config: Partial<LogStreamConfig> = {}
): LogStreamingService {
  return new LogStreamingService(config);
}
