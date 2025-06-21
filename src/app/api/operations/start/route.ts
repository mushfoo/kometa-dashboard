import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, logApiRequest } from '@/lib/api-utils';
import { KometaService } from '@/lib/KometaService';
import { OperationHistoryService } from '@/lib/OperationHistoryService';
import { SSEBroadcastService } from '@/lib/SSEBroadcastService';
import { z } from 'zod';
import path from 'path';

// Request body schema for starting operations
const StartOperationRequest = z.object({
  type: z.enum([
    'full_run',
    'collections_only',
    'library_only',
    'config_reload',
  ]),
  parameters: z
    .object({
      libraries: z.array(z.string()).optional(),
      collections: z.array(z.string()).optional(),
      dryRun: z.boolean().default(false),
      verbosity: z.enum(['debug', 'info', 'warning', 'error']).default('info'),
    })
    .default({}),
});

// Global service instances
const kometaService = new KometaService();
const historyService = new OperationHistoryService();
const sseBroadcastService = SSEBroadcastService.getInstance();

// Initialize SSE broadcasting
sseBroadcastService.initialize(kometaService);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate request body
    const parseResult = StartOperationRequest.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request format',
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const startRequest = parseResult.data;

    // Check if another operation is already running
    if (kometaService.isRunning()) {
      return createErrorResponse(
        new Error(
          'Another operation is already running. Please wait for it to complete.'
        ),
        'Operation already running'
      );
    }

    // Add operation to history
    const initialOperationId = await historyService.addOperation({
      type: startRequest.type,
      status: 'queued',
      startTime: new Date().toISOString(),
      parameters: startRequest.parameters,
    });

    try {
      // Build configuration for KometaService
      const config = {
        configPath: path.join(process.cwd(), 'storage', 'config.yml'),
        verbosity: startRequest.parameters.verbosity,
        dryRun: startRequest.parameters.dryRun,
        libraries: startRequest.parameters.libraries,
        collections: startRequest.parameters.collections,
        operationType: startRequest.type,
        timeouts: {
          gracefulShutdown: 10000, // 10 seconds
          healthCheck: 5000, // 5 seconds
        },
      };

      // Start the Kometa process using the comprehensive service
      const operationId = await kometaService.startProcess(config);

      // Update operation history with the actual operation ID from KometaService
      await historyService.updateOperation(initialOperationId, {
        status: 'running',
        startTime: new Date().toISOString(),
      });

      const response = {
        operationId,
        historyId: initialOperationId,
        status: 'started',
        message: `${startRequest.type} operation started successfully`,
      };

      logApiRequest(request, startTime);
      return NextResponse.json(response, { status: 202 }); // 202 Accepted
    } catch (error) {
      // Update operation status to failed
      await historyService.updateOperation(initialOperationId, {
        status: 'failed',
        endTime: new Date().toISOString(),
        results: {
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      });
      throw error;
    }
  } catch (error) {
    return createErrorResponse(error, 'Failed to start operation');
  }
}
