import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, logApiRequest } from '@/lib/api-utils';
import { KometaService } from '@/lib/KometaService';
import { OperationHistoryService } from '@/lib/OperationHistoryService';
import { z } from 'zod';

// Request body schema for stopping operations
const StopOperationRequest = z.object({
  operationId: z.string().optional(),
  force: z.boolean().default(false),
});

type StopOperationRequest = z.infer<typeof StopOperationRequest>;

class OperationStopService {
  private kometaService: KometaService;
  private historyService: OperationHistoryService;

  constructor() {
    this.kometaService = new KometaService();
    this.historyService = new OperationHistoryService();
  }

  async stopOperation(request: StopOperationRequest): Promise<{
    operationId: string;
    success: boolean;
    message: string;
  }> {
    // Get the current process info
    const processInfo = this.kometaService.getProcessInfo();

    if (!processInfo || !this.kometaService.isRunning()) {
      throw new Error('No operation is currently running');
    }

    // If specific operation ID provided, verify it matches
    if (
      request.operationId &&
      request.operationId !== processInfo.operationId
    ) {
      throw new Error(
        `Operation ${request.operationId} is not currently running`
      );
    }

    const operationId = processInfo.operationId;

    try {
      const success = await this.kometaService.stopProcess(request.force);

      if (success) {
        // The KometaService will handle updating its own status
        // We just need to update the operation history
        await this.historyService.updateOperation(operationId, {
          status: 'cancelled',
          endTime: new Date().toISOString(),
          duration: processInfo.startTime
            ? Date.now() - processInfo.startTime.getTime()
            : undefined,
        });

        return {
          operationId,
          success: true,
          message: request.force
            ? 'Operation forcefully terminated'
            : 'Operation gracefully stopped',
        };
      } else {
        throw new Error('Failed to stop the operation process');
      }
    } catch (error) {
      // Log the error but don't update operation status as it might still be running
      throw new Error(
        `Failed to stop operation ${operationId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async getRunningOperationStatus(): Promise<{
    hasRunningOperation: boolean;
    operationId?: string;
    type?: string;
    startTime?: string;
    duration?: number;
    status?: string;
    pid?: number;
  }> {
    const processInfo = this.kometaService.getProcessInfo();

    if (!processInfo) {
      return { hasRunningOperation: false };
    }

    const result: {
      hasRunningOperation: boolean;
      operationId?: string;
      type?: string;
      startTime?: string;
      duration?: number;
      status?: string;
      pid?: number;
    } = {
      hasRunningOperation: this.kometaService.isRunning(),
    };

    if (processInfo.operationId) {
      result.operationId = processInfo.operationId;
    }
    if (processInfo.config.operationType) {
      result.type = processInfo.config.operationType;
    }
    if (processInfo.startTime) {
      result.startTime = processInfo.startTime.toISOString();
      result.duration = Date.now() - processInfo.startTime.getTime();
    }
    if (processInfo.status) {
      result.status = processInfo.status;
    }
    if (processInfo.pid) {
      result.pid = processInfo.pid;
    }

    return result;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const stopRequest = StopOperationRequest.parse(body);

    const stopService = new OperationStopService();
    const result = await stopService.stopOperation(stopRequest);

    logApiRequest(request, startTime);
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'Failed to stop operation');
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const stopService = new OperationStopService();
    const status = await stopService.getRunningOperationStatus();

    logApiRequest(request, startTime);
    return NextResponse.json(status);
  } catch (error) {
    return createErrorResponse(error, 'Failed to get operation status');
  }
}
