import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, logApiRequest } from '@/lib/api-utils';
import {
  OperationHistoryService,
  OperationQueryParams,
} from '@/lib/OperationHistoryService';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const queryParams = OperationQueryParams.parse({
      status: searchParams.get('status'),
      type: searchParams.get('type'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    });

    const operationService = new OperationHistoryService();
    const history = await operationService.getHistory();

    const filteredOperations = operationService.filterOperations(
      history.operations,
      queryParams
    );

    const response = {
      operations: filteredOperations,
      total: history.operations.length,
      filtered: filteredOperations.length,
      pagination: {
        limit: queryParams.limit,
        offset: queryParams.offset,
        hasMore:
          queryParams.offset + queryParams.limit < history.operations.length,
      },
      lastUpdated: history.lastUpdated,
    };

    logApiRequest(request, startTime);
    return NextResponse.json(response);
  } catch (error) {
    return createErrorResponse(error, 'Failed to get operation history');
  }
}
