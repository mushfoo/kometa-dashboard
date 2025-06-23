/**
 * SSE Broadcast Service - Connects KometaService events to SSE streaming
 * This service listens to KometaService events and broadcasts them via SSE
 */

import { KometaService, LogOutput, ProcessInfo } from './KometaService';

interface SSEMessage {
  type: 'logs' | 'operations' | 'status';
  payload: unknown;
  operationId?: string;
  level?: string;
}

class SSEBroadcastService {
  private static instance: SSEBroadcastService | null = null;
  private kometaService: KometaService | null = null;
  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): SSEBroadcastService {
    if (!SSEBroadcastService.instance) {
      SSEBroadcastService.instance = new SSEBroadcastService();
    }
    return SSEBroadcastService.instance;
  }

  /**
   * Initialize the service with a KometaService instance
   */
  initialize(kometaService: KometaService): void {
    if (this.isInitialized) {
      return;
    }

    this.kometaService = kometaService;
    this.setupEventListeners();
    this.isInitialized = true;
  }

  /**
   * Set up event listeners for KometaService events
   */
  private setupEventListeners(): void {
    if (!this.kometaService) return;

    // Listen for log output events
    this.kometaService.on('logOutput', (logEntry: LogOutput) => {
      this.broadcastLogEntry(logEntry);
    });

    // Listen for process started events
    this.kometaService.on(
      'processStarted',
      (data: { operationId: string; pid?: number; config: unknown }) => {
        this.broadcastOperationUpdate({
          type: 'started',
          operationId: data.operationId,
          pid: data.pid,
          config: data.config,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // Listen for process stopping events
    this.kometaService.on(
      'processStopping',
      (data: { operationId: string; force: boolean }) => {
        this.broadcastOperationUpdate({
          type: 'stopping',
          operationId: data.operationId,
          force: data.force,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // Listen for process exited events
    this.kometaService.on(
      'processExited',
      (data: {
        operationId: string;
        exitCode?: number;
        signal?: string;
        status: string;
      }) => {
        this.broadcastOperationUpdate({
          type: 'exited',
          operationId: data.operationId,
          exitCode: data.exitCode,
          signal: data.signal,
          status: data.status,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // Listen for process error events
    this.kometaService.on(
      'processError',
      (data: { operationId: string; error: string }) => {
        this.broadcastOperationUpdate({
          type: 'error',
          operationId: data.operationId,
          error: data.error,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // Listen for log buffer cleared events
    this.kometaService.on('logBufferCleared', () => {
      this.broadcastLogEntry({
        timestamp: new Date(),
        level: 'INFO',
        message: 'Log buffer cleared',
        source: 'stdout',
      });
    });
  }

  /**
   * Broadcast a log entry via SSE
   */
  private async broadcastLogEntry(logEntry: LogOutput): Promise<void> {
    // Send the log data in the format expected by the frontend useSSE hook
    await this.sendToSSEEndpoint({
      type: 'logs',
      payload: {
        logs: [
          {
            timestamp: logEntry.timestamp.toISOString(),
            level: logEntry.level,
            message: logEntry.message,
            source: logEntry.source,
            operationId: logEntry.operationId,
          },
        ],
      },
      ...(logEntry.operationId && { operationId: logEntry.operationId }),
      level: logEntry.level,
    });
  }

  /**
   * Broadcast an operation update via SSE
   */
  private async broadcastOperationUpdate(
    operationData: unknown
  ): Promise<void> {
    const message: SSEMessage = {
      type: 'operations',
      payload: operationData,
    };

    await this.sendToSSEEndpoint(message);
  }

  /**
   * Broadcast a status update via SSE
   */
  async broadcastStatusUpdate(statusData: unknown): Promise<void> {
    const message: SSEMessage = {
      type: 'status',
      payload: statusData,
    };

    await this.sendToSSEEndpoint(message);
  }

  /**
   * Send message to SSE endpoint for broadcasting
   */
  private async sendToSSEEndpoint(message: SSEMessage): Promise<void> {
    try {
      // Import and use the connection manager directly to avoid HTTP calls
      const { connectionManager } = await import('@/lib/SSEConnectionManager');

      connectionManager.broadcast({
        type: message.type,
        payload: message.payload,
        operationId: message.operationId,
        level: message.level,
      });
    } catch (error) {
      console.warn('Error broadcasting SSE message:', error);
    }
  }

  /**
   * Get current process info for status broadcasting
   */
  getCurrentProcessInfo(): ProcessInfo | null {
    return this.kometaService?.getProcessInfo() || null;
  }

  /**
   * Get recent logs for buffer sending
   */
  getRecentLogs(count: number = 100): LogOutput[] {
    return this.kometaService?.getRecentLogs(count) || [];
  }
}

export { SSEBroadcastService };
export type { SSEMessage };
