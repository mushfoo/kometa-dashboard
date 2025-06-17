import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Query parameters schema for stream configuration
const StreamQuerySchema = z.object({
  type: z.enum(['logs', 'operations', 'status']).default('logs'),
  operationId: z.string().optional(),
  level: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR']).optional(),
  buffer: z.coerce.number().min(0).max(1000).default(100), // Number of buffered items to send initially
});

// Global connection manager to track active SSE connections
class SSEConnectionManager {
  private connections = new Map<
    string,
    {
      response: Response;
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
    response: Response,
    controller: ReadableStreamDefaultController,
    filters: z.infer<typeof StreamQuerySchema>
  ): void {
    this.connections.set(connectionId, {
      response,
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
    // const message = `data: ${JSON.stringify(data)}\n\n`;

    for (const [connectionId, connection] of this.connections.entries()) {
      try {
        // Check if this connection should receive this data
        if (!this.shouldReceiveData(connection.filters, data)) {
          continue;
        }

        connection.controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
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

// Global connection manager instance
const connectionManager = new SSEConnectionManager();

// Rate limiting for SSE connections
const connectionRateLimit = new Map<
  string,
  {
    count: number;
    lastReset: Date;
  }
>();

const MAX_CONNECTIONS_PER_IP = 5;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

/**
 * Check if IP is within rate limits
 */
function checkRateLimit(ip: string): boolean {
  const now = new Date();
  const existing = connectionRateLimit.get(ip);

  if (!existing) {
    connectionRateLimit.set(ip, { count: 1, lastReset: now });
    return true;
  }

  // Reset count if window has passed
  if (now.getTime() - existing.lastReset.getTime() > RATE_LIMIT_WINDOW) {
    existing.count = 1;
    existing.lastReset = now;
    return true;
  }

  // Check if within limit
  if (existing.count >= MAX_CONNECTIONS_PER_IP) {
    return false;
  }

  existing.count++;
  return true;
}

/**
 * GET /api/stream - Establish SSE connection for real-time updates
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const filters = StreamQuerySchema.parse(queryParams);

    // Get client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Check rate limits
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Too many connections from this IP.' },
        { status: 429 }
      );
    }

    // Generate unique connection ID
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create SSE response stream
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        controller.enqueue(
          `data: ${JSON.stringify({
            type: 'connection',
            payload: {
              connectionId,
              filters,
              timestamp: new Date().toISOString(),
            },
          })}\n\n`
        );

        // Send buffered data if requested
        if (filters.buffer > 0) {
          void sendBufferedData(controller, filters);
        }

        // Register connection
        connectionManager.addConnection(
          connectionId,
          response,
          controller,
          filters
        );

        // Send periodic keepalive messages
        const keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'keepalive',
                payload: { timestamp: new Date().toISOString() },
              })}\n\n`
            );
          } catch {
            clearInterval(keepAliveInterval);
            connectionManager.removeConnection(connectionId);
          }
        }, 30000); // Every 30 seconds

        // Handle connection close
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAliveInterval);
          connectionManager.removeConnection(connectionId);
        });
      },

      cancel() {
        connectionManager.removeConnection(connectionId);
      },
    });

    // Create response with SSE headers
    const response = new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

    return response;
  } catch (error) {
    console.error('SSE stream error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to establish stream connection' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stream - Broadcast data to SSE connections
 * This endpoint is for internal use by other services to push updates
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Verify this is an internal request (in production, use proper authentication)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== 'Bearer internal-service') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate broadcast data
    const BroadcastSchema = z.object({
      type: z.enum(['logs', 'operations', 'status']),
      payload: z.unknown(),
      operationId: z.string().optional(),
      level: z.string().optional(),
    });

    const data = BroadcastSchema.parse(body);

    // Broadcast to all matching connections
    connectionManager.broadcast({
      type: data.type,
      payload: data.payload,
      operationId: data.operationId ?? undefined,
      level: data.level ?? undefined,
    });

    return NextResponse.json({
      success: true,
      broadcastTo: connectionManager.getStats().totalConnections,
    });
  } catch (error) {
    console.error('SSE broadcast error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid broadcast data',
          details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to broadcast data' },
      { status: 500 }
    );
  }
}

/**
 * Send buffered historical data to new connections
 */
async function sendBufferedData(
  controller: ReadableStreamDefaultController,
  filters: z.infer<typeof StreamQuerySchema>
): Promise<void> {
  try {
    // This would typically fetch from your data services
    // For now, send a placeholder message
    controller.enqueue(
      `data: ${JSON.stringify({
        type: 'buffer',
        payload: {
          message: `Buffered data for ${filters.type} (last ${filters.buffer} items)`,
          filters,
          timestamp: new Date().toISOString(),
        },
      })}\n\n`
    );

    // TODO: Implement actual buffered data retrieval based on filters.type
    // - For logs: get recent log entries from LogService
    // - For operations: get recent operation status from OperationService
    // - For status: get current system status
  } catch (error) {
    console.error('Error sending buffered data:', error);
  }
}

/**
 * Export connection manager for use by other services
 */
export { connectionManager };

/**
 * Graceful shutdown handler
 */
process.on('SIGTERM', () => {
  connectionManager.shutdown();
});

process.on('SIGINT', () => {
  connectionManager.shutdown();
});
