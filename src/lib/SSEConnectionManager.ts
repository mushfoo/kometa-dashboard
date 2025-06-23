/**
 * SSE Connection Manager - Manages Server-Sent Event connections
 */

import { z } from 'zod';

// Query parameters schema for stream configuration
const StreamQuerySchema = z.object({
  type: z.enum(['logs', 'operations', 'status']).default('logs'),
  operationId: z.string().optional(),
  level: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR']).optional(),
  buffer: z.coerce.number().min(0).max(1000).default(100),
});

export class SSEConnectionManager {
  private connections = new Map<
    string,
    {
      controller: ReadableStreamDefaultController;
      lastActivity: Date;
      filters: z.infer<typeof StreamQuerySchema>;
    }
  >();

  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up stale connections every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 30000);
  }

  /**
   * Add a new SSE connection
   */
  addConnection(
    connectionId: string,
    controller: ReadableStreamDefaultController,
    filters: z.infer<typeof StreamQuerySchema>
  ): void {
    this.connections.set(connectionId, {
      controller,
      lastActivity: new Date(),
      filters,
    });

    console.log(
      `SSE connection added: ${connectionId}, total: ${this.connections.size}`
    );
  }

  /**
   * Remove an SSE connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      try {
        connection.controller.close();
      } catch {
        // Ignore errors when closing
      }
      this.connections.delete(connectionId);
      console.log(
        `SSE connection removed: ${connectionId}, total: ${this.connections.size}`
      );
    }
  }

  /**
   * Broadcast data to all matching connections
   */
  broadcast(data: {
    type: 'logs' | 'operations' | 'status';
    payload: unknown;
    operationId?: string | undefined;
    level?: string | undefined;
  }): void {
    for (const [connectionId, connection] of this.connections.entries()) {
      try {
        // Check if this connection should receive this data
        if (!this.shouldReceiveData(connection.filters, data)) {
          continue;
        }

        // Send the payload directly for data matching the connection type
        const messageData =
          data.type === connection.filters.type ? data.payload : data;
        connection.controller.enqueue(
          `data: ${JSON.stringify(messageData)}\n\n`
        );
        connection.lastActivity = new Date();
      } catch (error) {
        console.warn(`Failed to send to connection ${connectionId}:`, error);
        this.removeConnection(connectionId);
      }
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    connectionsByType: Record<string, number>;
    oldestConnection?: Date | undefined;
  } {
    const connectionsByType: Record<string, number> = {};
    let oldestConnection: Date | undefined;

    for (const connection of this.connections.values()) {
      const type = connection.filters.type;
      connectionsByType[type] = (connectionsByType[type] || 0) + 1;

      if (!oldestConnection || connection.lastActivity < oldestConnection) {
        oldestConnection = connection.lastActivity;
      }
    }

    return {
      totalConnections: this.connections.size,
      connectionsByType,
      oldestConnection: oldestConnection ?? undefined,
    };
  }

  /**
   * Clean up connections that haven't been active recently
   */
  private cleanupStaleConnections(): void {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes

    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.lastActivity < staleThreshold) {
        console.log(`Removing stale SSE connection: ${connectionId}`);
        this.removeConnection(connectionId);
      }
    }
  }

  /**
   * Check if a connection should receive specific data
   */
  private shouldReceiveData(
    filters: z.infer<typeof StreamQuerySchema>,
    data: {
      type: 'logs' | 'operations' | 'status';
      payload: unknown;
      operationId?: string | undefined;
      level?: string | undefined;
    }
  ): boolean {
    // Type filter
    if (filters.type !== data.type) {
      return false;
    }

    // Operation ID filter
    if (filters.operationId && data.operationId !== filters.operationId) {
      return false;
    }

    // Log level filter (for logs type)
    if (
      filters.type === 'logs' &&
      filters.level &&
      data.level !== filters.level
    ) {
      return false;
    }

    return true;
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const connectionId of this.connections.keys()) {
      this.removeConnection(connectionId);
    }
  }
}

// Global singleton instance
export const connectionManager = new SSEConnectionManager();

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  connectionManager.shutdown();
});

process.on('SIGINT', () => {
  connectionManager.shutdown();
});
