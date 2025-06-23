import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SSEBroadcastService } from '@/lib/SSEBroadcastService';
import { connectionManager } from '@/lib/SSEConnectionManager';

// Query parameters schema for stream configuration
const StreamQuerySchema = z.object({
  type: z.enum(['logs', 'operations', 'status']).default('logs'),
  operationId: z.string().optional(),
  level: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR']).optional(),
  buffer: z.coerce.number().min(0).max(1000).default(100), // Number of buffered items to send initially
});

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
        connectionManager.addConnection(connectionId, controller, filters);

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
    // Verify this is an internal request
    // TODO: Replace with proper JWT/token-based authentication for production
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
    const sseBroadcastService = SSEBroadcastService.getInstance();

    switch (filters.type) {
      case 'logs': {
        // Get recent log entries from KometaService
        const recentLogs = sseBroadcastService.getRecentLogs(filters.buffer);

        // Filter logs
        const filteredLogs = recentLogs.filter((logEntry) => {
          if (filters.level && logEntry.level !== filters.level) {
            return false;
          }
          if (
            filters.operationId &&
            logEntry.operationId !== filters.operationId
          ) {
            return false;
          }
          return true;
        });

        // Send all logs as a single batch
        if (filteredLogs.length > 0) {
          controller.enqueue(
            `data: ${JSON.stringify({
              logs: filteredLogs.map((logEntry) => ({
                timestamp: logEntry.timestamp.toISOString(),
                level: logEntry.level,
                message: logEntry.message,
                source: logEntry.source,
                operationId: logEntry.operationId,
              })),
            })}\n\n`
          );
        }
        break;
      }

      case 'operations': {
        // Get current process info
        const processInfo = sseBroadcastService.getCurrentProcessInfo();
        if (processInfo) {
          controller.enqueue(
            `data: ${JSON.stringify({
              type: 'operations',
              payload: {
                type: 'current_status',
                operationId: processInfo.operationId,
                status: processInfo.status,
                startTime: processInfo.startTime?.toISOString(),
                endTime: processInfo.endTime?.toISOString(),
                pid: processInfo.pid,
                config: processInfo.config,
                timestamp: new Date().toISOString(),
              },
            })}\n\n`
          );
        }
        break;
      }

      case 'status': {
        // Send current system status
        const processInfo = sseBroadcastService.getCurrentProcessInfo();
        controller.enqueue(
          `data: ${JSON.stringify({
            type: 'status',
            payload: {
              hasActiveOperation: !!processInfo,
              operationStatus: processInfo?.status || 'idle',
              timestamp: new Date().toISOString(),
            },
          })}\n\n`
        );
        break;
      }
    }

    // Send buffer completion message
    controller.enqueue(
      `data: ${JSON.stringify({
        type: 'buffer',
        payload: {
          message: `Buffered data sent for ${filters.type} (${filters.buffer} items max)`,
          filters,
          timestamp: new Date().toISOString(),
        },
      })}\n\n`
    );
  } catch (error) {
    console.error('Error sending buffered data:', error);

    // Send error message to client
    controller.enqueue(
      `data: ${JSON.stringify({
        type: 'error',
        payload: {
          message: 'Failed to retrieve buffered data',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      })}\n\n`
    );
  }
}

/**
 * Connection manager instance is imported from separate service module
 */
