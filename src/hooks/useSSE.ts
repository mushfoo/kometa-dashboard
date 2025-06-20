import { useEffect, useState, useRef } from 'react';

interface SSEData {
  logs?: Array<{
    timestamp: string;
    level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
    message: string;
    source: 'stdout' | 'stderr';
    operationId?: string;
  }>;
  operations?: Array<{
    id: string;
    type: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: string;
    endTime?: string;
    progress?: number;
  }>;
  status?: {
    processStatus:
      | 'idle'
      | 'starting'
      | 'running'
      | 'stopping'
      | 'stopped'
      | 'crashed'
      | 'failed';
    operationId?: string;
    progress?: number;
    currentCollection?: string;
    eta?: string;
  };
}

interface UseSSEOptions {
  type?: 'logs' | 'operations' | 'status';
  operationId?: string;
  level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  buffer?: number;
  enabled?: boolean;
}

export function useSSE({
  type = 'logs',
  operationId,
  level,
  buffer = 100,
  enabled = true,
}: UseSSEOptions = {}) {
  const [data, setData] = useState<SSEData>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Build query parameters
    const params = new URLSearchParams({
      type,
      buffer: buffer.toString(),
    });

    if (operationId) params.set('operationId', operationId);
    if (level) params.set('level', level);

    const url = `/api/stream?${params.toString()}`;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new EventSource connection
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const newData: SSEData = JSON.parse(event.data);
        setData((prevData) => ({
          ...prevData,
          ...newData,
        }));
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
        setError('Failed to parse server data');
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost');

      // Automatically reconnect after 5 seconds
      setTimeout(() => {
        if (enabled) {
          setError(null);
          // The useEffect will recreate the connection due to dependency changes
        }
      }, 5000);
    };

    // Cleanup function
    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [type, operationId, level, buffer, enabled]);

  // Close connection when component unmounts
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    data,
    isConnected,
    error,
    reconnect: () => {
      setError(null);
      // Trigger useEffect to recreate connection
      setData({});
    },
  };
}
