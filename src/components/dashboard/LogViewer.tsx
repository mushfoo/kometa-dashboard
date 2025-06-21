'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Terminal,
  ScrollText,
  Filter,
  Download,
  Trash2,
  ArrowDown,
  ArrowUp,
  Wifi,
  WifiOff,
  Search,
  X,
  Calendar,
} from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  source: 'stdout' | 'stderr';
  operationId?: string;
}

interface LogViewerProps {
  className?: string;
  maxHeight?: string;
}

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR'] as const;

function LogLevelBadge({ level }: { level: string }) {
  const colors = {
    DEBUG: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    INFO: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    WARNING:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    ERROR: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded ${colors[level as keyof typeof colors] || colors.INFO}`}
    >
      {level}
    </span>
  );
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

export function LogViewer({ className, maxHeight = '400px' }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegexSearch, setIsRegexSearch] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  const { data, isConnected, error } = useSSE({
    type: 'logs',
    level: selectedLevel as any,
    buffer: 100,
    enabled: true,
  });

  // Update logs when new data arrives via SSE
  useEffect(() => {
    if (data.logs) {
      setLogs((prevLogs) => {
        const newLogs = [...prevLogs, ...data.logs!];
        // Keep only the last 1000 logs for performance
        return newLogs.slice(-1000);
      });
    }
  }, [data.logs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && shouldScrollRef.current && logContainerRef.current) {
      const container = logContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle scroll events to detect if user scrolled away from bottom
  const handleScroll = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 10;
      setIsAtBottom(isNearBottom);

      if (!isNearBottom) {
        shouldScrollRef.current = false;
      } else {
        shouldScrollRef.current = true;
      }
    }
  };

  // Filter logs based on all criteria
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Level filter
    if (selectedLevel) {
      filtered = filtered.filter((log) => log.level === selectedLevel);
    }

    // Date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      const filterDateString = filterDate.toDateString();
      filtered = filtered.filter((log) => {
        try {
          const logDate = new Date(log.timestamp);
          return logDate.toDateString() === filterDateString;
        } catch {
          return false;
        }
      });
    }

    // Search filter
    if (searchTerm.trim()) {
      if (isRegexSearch) {
        try {
          const regex = new RegExp(searchTerm, 'i');
          filtered = filtered.filter((log) => regex.test(log.message));
        } catch {
          // Invalid regex, fall back to simple string search
          const term = searchTerm.toLowerCase();
          filtered = filtered.filter((log) =>
            log.message.toLowerCase().includes(term)
          );
        }
      } else {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter((log) =>
          log.message.toLowerCase().includes(term)
        );
      }
    }

    return filtered;
  }, [logs, selectedLevel, searchTerm, isRegexSearch, dateFilter]);

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setAutoScroll(true);
      shouldScrollRef.current = true;
    }
  };

  const scrollToTop = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
      setAutoScroll(false);
      shouldScrollRef.current = false;
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const logsText = filteredLogs
      .map(
        (log) =>
          `[${formatTimestamp(log.timestamp)}] ${log.level}: ${log.message}`
      )
      .join('\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kometa-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={`${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Live Logs</h3>
            <div className="flex items-center gap-2 ml-4">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className="text-xs text-gray-500">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {filteredLogs.length} entries
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              Connection error: {error}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="space-y-3">
          {/* Main Controls Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Level Filter */}
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
            >
              <option value="">All Levels</option>
              {LOG_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>

            {/* Filter Toggle */}
            <Button
              size="sm"
              variant={showFilters ? 'default' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-1" />
              Filters
            </Button>

            {/* Auto-scroll toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>

            <div className="flex gap-1 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={scrollToTop}
                title="Scroll to top"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={scrollToBottom}
                disabled={isAtBottom}
                title="Scroll to bottom"
              >
                <ArrowDown className="w-4 h-4" />
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={exportLogs}
                title="Export logs"
              >
                <Download className="w-4 h-4" />
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={clearLogs}
                title="Clear logs"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Messages</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search log messages..."
                      className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      >
                        <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isRegexSearch}
                      onChange={(e) => setIsRegexSearch(e.target.checked)}
                      className="rounded"
                    />
                    Regex
                  </label>
                </div>
                {isRegexSearch && (
                  <p className="text-xs text-gray-500">
                    Use regular expressions for pattern matching (e.g.,
                    &quot;error|warning&quot; or &quot;\\d{4}-\\d{2}-\\d{2}
                    &quot;)
                  </p>
                )}
              </div>

              {/* Date Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by Date</label>
                <div className="flex gap-2">
                  <div className="relative">
                    <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    />
                  </div>
                  {dateFilter && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDateFilter('')}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Active Filters Summary */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-xs text-gray-500">Active filters:</span>
                {selectedLevel && (
                  <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                    Level: {selectedLevel}
                  </span>
                )}
                {searchTerm && (
                  <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                    Search: &quot;
                    {searchTerm.length > 20
                      ? searchTerm.substring(0, 20) + '...'
                      : searchTerm}
                    &quot;
                    {isRegexSearch && ' (regex)'}
                  </span>
                )}
                {dateFilter && (
                  <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                    Date: {new Date(dateFilter).toLocaleDateString()}
                  </span>
                )}
                {!selectedLevel && !searchTerm && !dateFilter && (
                  <span className="text-xs text-gray-400">None</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Log Display */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto font-mono text-sm"
        style={{ height: maxHeight }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No logs to display</p>
              <p className="text-xs mt-1">
                {selectedLevel
                  ? `No ${selectedLevel} logs found`
                  : 'Waiting for log data...'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-3 py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded text-xs"
              >
                <span className="text-gray-500 dark:text-gray-400 shrink-0 w-16">
                  {formatTimestamp(log.timestamp)}
                </span>
                <LogLevelBadge level={log.level} />
                <span className="flex-1 break-words">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isAtBottom && autoScroll && (
        <div className="absolute bottom-16 right-4">
          <Button size="sm" onClick={scrollToBottom} className="shadow-lg">
            <ArrowDown className="w-4 h-4 mr-1" />
            Jump to bottom
          </Button>
        </div>
      )}
    </Card>
  );
}
