import { EventEmitter } from 'events';

// Enhanced log entry interface
export interface ParsedLogEntry {
  id: string;
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  source: 'stdout' | 'stderr' | 'system';
  operationId?: string | undefined;
  component?: string | undefined; // Kometa component that generated the log
  metadata?: Record<string, unknown>;
  rawLine: string;
}

// Log filtering options
export interface LogFilter {
  level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  levels?: Array<'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'>;
  component?: string;
  operationId?: string;
  search?: string; // Text search in message
  regex?: RegExp; // Regex pattern for advanced search
  startTime?: Date;
  endTime?: Date;
}

// Kometa log patterns for parsing
const KOMETA_LOG_PATTERNS = [
  // Standard Kometa format: [YYYY-MM-DD HH:MM:SS] LEVEL: Component: Message
  {
    regex:
      /^\[(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\]\s+(DEBUG|INFO|WARNING|ERROR):\s*([^:]+):\s*(.+)$/,
    groups: { timestamp: 1, level: 2, component: 3, message: 4 },
  },
  // Simplified format: LEVEL: Message
  {
    regex: /^(DEBUG|INFO|WARNING|ERROR):\s*(.+)$/,
    groups: { level: 1, message: 2 },
  },
  // Docker/Python format with timestamp prefix
  {
    regex: /^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2},\d{3})\s+(\w+)\s+(.+)$/,
    groups: { timestamp: 1, level: 2, message: 3 },
  },
  // Generic timestamped log
  {
    regex: /^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s+(.+)$/,
    groups: { timestamp: 1, message: 2 },
  },
];

/**
 * LogParser handles parsing of Kometa log output with support for various formats,
 * circular buffering, filtering, and real-time streaming capabilities.
 */
export class LogParser extends EventEmitter {
  private logBuffer: ParsedLogEntry[];
  private readonly maxBufferSize: number;
  private bufferIndex = 0;
  private bufferCount = 0;
  private logCounter = 0;

  constructor(maxBufferSize: number = 1000) {
    super();
    this.maxBufferSize = maxBufferSize;
    this.logBuffer = new Array(maxBufferSize);
    this.setMaxListeners(50); // Support many real-time listeners
  }

  /**
   * Parse a raw log line into a structured log entry
   */
  parseLine(
    rawLine: string,
    source: 'stdout' | 'stderr' | 'system' = 'stdout',
    operationId?: string
  ): ParsedLogEntry {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) {
      return this.createDefaultEntry(rawLine, source, operationId);
    }

    // Try each pattern until we find a match
    for (const pattern of KOMETA_LOG_PATTERNS) {
      const match = trimmedLine.match(pattern.regex);
      if (match) {
        return this.createParsedEntry(
          match,
          pattern,
          rawLine,
          source,
          operationId
        );
      }
    }

    // If no pattern matches, create a default entry
    return this.createDefaultEntry(rawLine, source, operationId);
  }

  /**
   * Add a parsed log entry to the buffer
   */
  addLogEntry(entry: ParsedLogEntry): void {
    // Add to circular buffer (O(1) operation)
    this.logBuffer[this.bufferIndex] = entry;
    this.bufferIndex = (this.bufferIndex + 1) % this.maxBufferSize;
    this.bufferCount = Math.min(this.bufferCount + 1, this.maxBufferSize);

    // Emit events for real-time processing
    this.emit('logEntry', entry);

    // Emit specific events for different log levels
    if (entry.level === 'ERROR') {
      this.emit('error', entry);
    } else if (entry.level === 'WARNING') {
      this.emit('warning', entry);
    }
  }

  /**
   * Parse and add a raw line to the buffer
   */
  processLine(
    rawLine: string,
    source: 'stdout' | 'stderr' | 'system' = 'stdout',
    operationId?: string
  ): ParsedLogEntry {
    const entry = this.parseLine(rawLine, source, operationId);
    this.addLogEntry(entry);
    return entry;
  }

  /**
   * Get filtered logs from the buffer
   */
  getFilteredLogs(filter: LogFilter = {}): ParsedLogEntry[] {
    let filtered = this.getAllLogs();

    // Filter by log level(s)
    if (filter.level) {
      filtered = filtered.filter((entry) => entry.level === filter.level);
    } else if (filter.levels && filter.levels.length > 0) {
      filtered = filtered.filter((entry) =>
        filter.levels!.includes(entry.level)
      );
    }

    // Filter by component
    if (filter.component) {
      filtered = filtered.filter(
        (entry) => entry.component === filter.component
      );
    }

    // Filter by operation ID
    if (filter.operationId) {
      filtered = filtered.filter(
        (entry) => entry.operationId === filter.operationId
      );
    }

    // Filter by time range
    if (filter.startTime) {
      filtered = filtered.filter(
        (entry) => entry.timestamp >= filter.startTime!
      );
    }
    if (filter.endTime) {
      filtered = filtered.filter((entry) => entry.timestamp <= filter.endTime!);
    }

    // Text search in message
    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.message.toLowerCase().includes(searchTerm) ||
          entry.component?.toLowerCase().includes(searchTerm)
      );
    }

    // Regex pattern search
    if (filter.regex) {
      filtered = filtered.filter(
        (entry) =>
          filter.regex!.test(entry.message) ||
          (entry.component && filter.regex!.test(entry.component))
      );
    }

    return filtered;
  }

  /**
   * Get recent logs (last N entries)
   */
  getRecentLogs(count: number = 100): ParsedLogEntry[] {
    const allLogs = this.getAllLogs();
    return allLogs.slice(-count);
  }

  /**
   * Get all logs from buffer
   */
  getAllLogs(): ParsedLogEntry[] {
    if (this.bufferCount === 0) {
      return [];
    }

    if (this.bufferCount < this.maxBufferSize) {
      // Buffer not yet full, return from start to current position
      return this.logBuffer.slice(0, this.bufferCount);
    } else {
      // Buffer is full, return from current position to end, then start to current position
      const fromCurrent = this.logBuffer.slice(this.bufferIndex);
      const fromStart = this.logBuffer.slice(0, this.bufferIndex);
      return [...fromCurrent, ...fromStart];
    }
  }

  /**
   * Clear the log buffer
   */
  clearBuffer(): void {
    this.logBuffer = new Array(this.maxBufferSize);
    this.bufferIndex = 0;
    this.bufferCount = 0;
    this.emit('bufferCleared');
  }

  /**
   * Get buffer statistics
   */
  getBufferStats(): {
    totalEntries: number;
    byLevel: Record<string, number>;
    byComponent: Record<string, number>;
    oldestEntry?: Date | undefined;
    newestEntry?: Date | undefined;
  } {
    const byLevel: Record<string, number> = {
      DEBUG: 0,
      INFO: 0,
      WARNING: 0,
      ERROR: 0,
    };

    const byComponent: Record<string, number> = {};

    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    this.getAllLogs().forEach((entry) => {
      // Count by level
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;

      // Count by component
      if (entry.component) {
        byComponent[entry.component] = (byComponent[entry.component] || 0) + 1;
      }

      // Track oldest and newest
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    });

    return {
      totalEntries: this.bufferCount,
      byLevel,
      byComponent,
      oldestEntry: oldestEntry ?? undefined,
      newestEntry: newestEntry ?? undefined,
    };
  }

  /**
   * Search logs with advanced pattern matching
   */
  searchLogs(
    pattern: string | RegExp,
    options: {
      caseSensitive?: boolean;
      includeMetadata?: boolean;
      maxResults?: number;
    } = {}
  ): ParsedLogEntry[] {
    const {
      caseSensitive = false,
      includeMetadata = false,
      maxResults = 100,
    } = options;

    let searchRegex: RegExp;

    if (typeof pattern === 'string') {
      const flags = caseSensitive ? 'g' : 'gi';
      searchRegex = new RegExp(
        pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        flags
      );
    } else {
      searchRegex = pattern;
    }

    const results: ParsedLogEntry[] = [];
    const allLogs = this.getAllLogs();

    for (const entry of allLogs) {
      if (results.length >= maxResults) break;

      let found = false;

      // Search in message
      if (searchRegex.test(entry.message)) {
        found = true;
      }

      // Search in component
      if (!found && entry.component && searchRegex.test(entry.component)) {
        found = true;
      }

      // Search in metadata if requested
      if (!found && includeMetadata && entry.metadata) {
        const metadataString = JSON.stringify(entry.metadata);
        if (searchRegex.test(metadataString)) {
          found = true;
        }
      }

      if (found) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Get unique components from log buffer
   */
  getComponents(): string[] {
    const components = new Set<string>();
    this.getAllLogs().forEach((entry) => {
      if (entry.component) {
        components.add(entry.component);
      }
    });
    return Array.from(components).sort();
  }

  /**
   * Get unique operation IDs from log buffer
   */
  getOperationIds(): string[] {
    const operationIds = new Set<string>();
    this.getAllLogs().forEach((entry) => {
      if (entry.operationId) {
        operationIds.add(entry.operationId);
      }
    });
    return Array.from(operationIds).sort();
  }

  /**
   * Create a parsed entry from regex match
   */
  private createParsedEntry(
    match: RegExpMatchArray,
    pattern: { groups: Record<string, number> },
    rawLine: string,
    source: 'stdout' | 'stderr' | 'system',
    operationId?: string
  ): ParsedLogEntry {
    const groups = pattern.groups;

    // Extract timestamp
    let timestamp = new Date();
    if (groups.timestamp) {
      const timestampStr = match[groups.timestamp];
      if (timestampStr) {
        const parsed = this.parseTimestamp(timestampStr);
        if (parsed) {
          timestamp = parsed;
        }
      }
    }

    // Extract level
    let level: ParsedLogEntry['level'] = 'INFO';
    if (groups.level) {
      const levelStr = match[groups.level]?.toUpperCase();
      if (
        levelStr &&
        ['DEBUG', 'INFO', 'WARNING', 'ERROR'].includes(levelStr)
      ) {
        level = levelStr as ParsedLogEntry['level'];
      }
    }

    // Infer level from source if not explicitly set
    if (source === 'stderr' && level === 'INFO') {
      level = 'ERROR';
    }

    // Extract component
    const component = groups.component
      ? match[groups.component]?.trim()
      : undefined;

    // Extract message
    const message = groups.message
      ? match[groups.message]?.trim() || rawLine
      : rawLine;

    return {
      id: this.generateLogId(),
      timestamp,
      level,
      message,
      source,
      operationId: operationId ?? undefined,
      component: component ?? undefined,
      rawLine,
    };
  }

  /**
   * Create a default entry when no pattern matches
   */
  private createDefaultEntry(
    rawLine: string,
    source: 'stdout' | 'stderr' | 'system',
    operationId?: string
  ): ParsedLogEntry {
    // Infer log level from content
    let level: ParsedLogEntry['level'] = 'INFO';
    const upperLine = rawLine.toUpperCase();

    if (upperLine.includes('ERROR') || upperLine.includes('FAIL')) {
      level = 'ERROR';
    } else if (upperLine.includes('WARNING') || upperLine.includes('WARN')) {
      level = 'WARNING';
    } else if (upperLine.includes('DEBUG')) {
      level = 'DEBUG';
    }

    // Override for stderr
    if (source === 'stderr' && level === 'INFO') {
      level = 'ERROR';
    }

    return {
      id: this.generateLogId(),
      timestamp: new Date(),
      level,
      message: rawLine.trim() || rawLine,
      source,
      operationId: operationId ?? undefined,
      rawLine,
    };
  }

  /**
   * Parse various timestamp formats
   */
  private parseTimestamp(timestampStr: string): Date | null {
    const formats = [
      // ISO format: YYYY-MM-DD HH:MM:SS
      /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/,
      // With milliseconds: YYYY-MM-DD HH:MM:SS,SSS
      /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2},\d{3}$/,
      // With timezone: YYYY-MM-DD HH:MM:SS+TZ
      /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
    ];

    for (const format of formats) {
      if (format.test(timestampStr)) {
        // Convert timestamp to ISO format for proper parsing
        let isoTimestamp = timestampStr;

        // Replace comma with dot for milliseconds
        if (isoTimestamp.includes(',')) {
          isoTimestamp = isoTimestamp.replace(',', '.');
        }

        // Add 'T' separator and 'Z' timezone if missing
        if (
          /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(\.\d{3})?$/.test(isoTimestamp)
        ) {
          isoTimestamp = isoTimestamp.replace(' ', 'T') + 'Z';
        }

        const parsed = new Date(isoTimestamp);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    return null;
  }

  /**
   * Generate unique log entry ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${++this.logCounter}`;
  }
}
