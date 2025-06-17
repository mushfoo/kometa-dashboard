import { NextRequest, NextResponse } from 'next/server';
import { createProgressMonitoringService } from '@/lib/ProgressMonitoringService';
import { z } from 'zod';

// Query parameters schema
const ProgressQuerySchema = z.object({
  operationId: z.string().optional(),
  includeHistory: z.coerce.boolean().default(false),
  historyLimit: z.coerce.number().min(1).max(100).default(10),
});

// Progress monitoring service instance
const progressService = createProgressMonitoringService({
  storageDirectory: './storage/progress',
  updateInterval: 1000,
  maxProgressHistory: 100,
  enablePersistence: true,
});

// Load history on startup
void progressService.loadProgressHistory();

/**
 * GET /api/progress - Get operation progress
 *
 * Query parameters:
 * - operationId: Specific operation to get progress for
 * - includeHistory: Include progress history
 * - historyLimit: Number of history items to include
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const { operationId, includeHistory, historyLimit } =
      ProgressQuerySchema.parse(queryParams);

    // Get specific operation progress
    if (operationId) {
      const operation = progressService.getOperationProgress(operationId);

      if (!operation) {
        return NextResponse.json(
          { error: `Operation ${operationId} not found` },
          { status: 404 }
        );
      }

      const estimatedTimeRemaining =
        progressService.getEstimatedTimeRemaining(operationId);

      return NextResponse.json({
        operation,
        estimatedTimeRemaining,
      });
    }

    // Get all active operations
    const activeOperations = progressService.getActiveOperations();
    const stats = progressService.getMonitoringStats();

    const response: any = {
      activeOperations,
      stats,
    };

    // Include history if requested
    if (includeHistory) {
      response.history = progressService.getProgressHistory(historyLimit);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Progress API error:', error);

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
      { error: 'Failed to retrieve progress information' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/progress - Update operation progress
 * Used internally by the streaming service to update progress
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

    // Validate request body
    const UpdateProgressSchema = z.object({
      operationId: z.string(),
      action: z.enum(['start', 'stop', 'update', 'cancel']),
      operationType: z.string().optional(),
      status: z.enum(['completed', 'failed', 'cancelled']).optional(),
      logLine: z.string().optional(),
    });

    const { operationId, action, operationType, status, logLine } =
      UpdateProgressSchema.parse(body);

    switch (action) {
      case 'start':
        if (!operationType) {
          return NextResponse.json(
            { error: 'operationType is required for start action' },
            { status: 400 }
          );
        }
        await progressService.startMonitoring(operationId, operationType);
        break;

      case 'stop':
        await progressService.stopMonitoring(
          operationId,
          status || 'completed'
        );
        break;

      case 'update':
        if (!logLine) {
          return NextResponse.json(
            { error: 'logLine is required for update action' },
            { status: 400 }
          );
        }
        progressService.processLogLine(operationId, logLine);
        break;

      case 'cancel':
        await progressService.cancelOperation(operationId);
        break;
    }

    // Get updated progress
    const operation = progressService.getOperationProgress(operationId);
    const estimatedTimeRemaining = operation
      ? progressService.getEstimatedTimeRemaining(operationId)
      : undefined;

    return NextResponse.json({
      success: true,
      operation,
      estimatedTimeRemaining,
    });
  } catch (error) {
    console.error('Progress update error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/progress/:operationId - Cancel an operation
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const operationId = pathSegments[pathSegments.length - 1];

    if (!operationId || operationId === 'progress') {
      return NextResponse.json(
        { error: 'Operation ID is required' },
        { status: 400 }
      );
    }

    await progressService.cancelOperation(operationId);

    return NextResponse.json({
      success: true,
      message: `Operation ${operationId} cancelled`,
    });
  } catch (error) {
    console.error('Progress cancellation error:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to cancel operation' },
      { status: 500 }
    );
  }
}

// Export the progress service for use in other routes
export { progressService };
