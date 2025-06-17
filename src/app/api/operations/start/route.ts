import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, logApiRequest } from '@/lib/api-utils';
import {
  KometaOperationService,
  StartOperationRequest,
} from '@/lib/KometaOperationService';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const startRequest = StartOperationRequest.parse(body);

    const operationService = new KometaOperationService();
    const operationId = await operationService.startOperation(startRequest);

    const response = {
      operationId,
      status: 'started',
      message: `${startRequest.type} operation started successfully`,
    };

    logApiRequest(request, startTime);
    return NextResponse.json(response, { status: 202 }); // 202 Accepted
  } catch (error) {
    return createErrorResponse(error, 'Failed to start operation');
  }
}
