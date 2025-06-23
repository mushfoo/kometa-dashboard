import { FileStorageService } from './file-storage-service';
import path from 'path';
import { z } from 'zod';
import { promises as fs } from 'fs';

// Log entry schema
const LogEntry = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  level: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR']),
  message: z.string(),
  source: z.string().optional(),
  operationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

type LogEntry = z.infer<typeof LogEntry>;

// Query parameters for filtering logs
const LogQueryParams = z.object({
  level: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR']).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  operationId: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  search: z.string().optional().nullable(), // Text search in messages
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
});

type LogQueryParams = z.infer<typeof LogQueryParams>;

class LogService {
  private storage: FileStorageService;
  private readonly maxLogsPerFile = 10000;

  constructor() {
    this.storage = new FileStorageService(
      path.join(process.cwd(), 'storage', 'history')
    );
  }

  async getLogs(filters: LogQueryParams): Promise<{
    logs: LogEntry[];
    total: number;
    filtered: number;
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    // Get current month's logs file
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const logsFile = `logs-${currentMonth}.json`;

    const logs = await this.storage.read<{ logs: LogEntry[] }>(logsFile);
    const allLogs = logs?.logs || [];

    // Apply filters
    const filteredLogs = this.filterLogs(allLogs, filters);

    // Apply pagination
    const start = filters.offset;
    const end = start + filters.limit;
    const paginatedLogs = filteredLogs.slice(start, end);

    return {
      logs: paginatedLogs,
      total: allLogs.length,
      filtered: filteredLogs.length,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: end < filteredLogs.length,
      },
    };
  }

  private filterLogs(logs: LogEntry[], filters: LogQueryParams): LogEntry[] {
    let filtered = logs;

    // Filter by log level
    if (filters.level && filters.level !== null) {
      filtered = filtered.filter((log) => log.level === filters.level);
    }

    // Filter by date range
    if (filters.startDate && filters.startDate !== null) {
      filtered = filtered.filter((log) => log.timestamp >= filters.startDate!);
    }

    if (filters.endDate && filters.endDate !== null) {
      filtered = filtered.filter((log) => log.timestamp <= filters.endDate!);
    }

    // Filter by operation ID
    if (filters.operationId && filters.operationId !== null) {
      filtered = filtered.filter(
        (log) => log.operationId === filters.operationId
      );
    }

    // Filter by source
    if (filters.source && filters.source !== null) {
      filtered = filtered.filter((log) => log.source === filters.source);
    }

    // Text search in messages
    if (filters.search && filters.search !== null) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter((log) =>
        log.message.toLowerCase().includes(searchTerm)
      );
    }

    // Sort by timestamp (newest first)
    filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return filtered;
  }

  async addLog(entry: Omit<LogEntry, 'id'>): Promise<string> {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const logsFile = `logs-${currentMonth}.json`;

    const logs = await this.storage.read<{ logs: LogEntry[] }>(logsFile);
    const currentLogs = logs?.logs || [];

    const newLogEntry: LogEntry = {
      ...entry,
      id: logId,
    };

    currentLogs.unshift(newLogEntry);

    // Keep only the last maxLogsPerFile entries
    if (currentLogs.length > this.maxLogsPerFile) {
      currentLogs.splice(this.maxLogsPerFile);
    }

    await this.storage.write(logsFile, { logs: currentLogs });

    return logId;
  }

  async getLogSources(): Promise<string[]> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const logsFile = `logs-${currentMonth}.json`;

    const logs = await this.storage.read<{ logs: LogEntry[] }>(logsFile);
    const allLogs = logs?.logs || [];

    const sources = new Set<string>();
    allLogs.forEach((log) => {
      if (log.source) {
        sources.add(log.source);
      }
    });

    return Array.from(sources).sort();
  }

  async getLogStatistics(): Promise<{
    totalLogs: number;
    logsByLevel: Record<string, number>;
    recentErrorsCount: number;
    logFiles: string[];
  }> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const logsFile = `logs-${currentMonth}.json`;

    const logs = await this.storage.read<{ logs: LogEntry[] }>(logsFile);
    const allLogs = logs?.logs || [];

    // Count logs by level
    const logsByLevel: Record<string, number> = {
      DEBUG: 0,
      INFO: 0,
      WARNING: 0,
      ERROR: 0,
    };

    allLogs.forEach((log) => {
      logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;
    });

    // Count recent errors (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentErrorsCount = allLogs.filter(
      (log) => log.level === 'ERROR' && log.timestamp >= yesterday
    ).length;

    // Get available log files
    const logFiles = await this.getAvailableLogFiles();

    return {
      totalLogs: allLogs.length,
      logsByLevel,
      recentErrorsCount,
      logFiles,
    };
  }

  private async getAvailableLogFiles(): Promise<string[]> {
    try {
      const historyPath = path.join(process.cwd(), 'storage', 'history');
      const files = await fs.readdir(historyPath);

      return files
        .filter((file) => file.startsWith('logs-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first
    } catch {
      return [];
    }
  }
}

export { LogService, LogEntry, LogQueryParams };
export type { LogEntry as LogEntryType };
