import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, logApiRequest } from '@/lib/api-utils';
import { LogService, LogQueryParams } from '@/lib/LogService';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Check if this is a request for statistics
    if (searchParams.get('stats') === 'true') {
      const logService = new LogService();
      const stats = await logService.getLogStatistics();

      logApiRequest(request, startTime);
      return NextResponse.json(stats);
    }

    // Check if this is a request for sources
    if (searchParams.get('sources') === 'true') {
      const logService = new LogService();
      const sources = await logService.getLogSources();

      logApiRequest(request, startTime);
      return NextResponse.json({ sources });
    }

    // Regular log retrieval with filtering
    const queryParams = LogQueryParams.parse({
      level: searchParams.get('level'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      operationId: searchParams.get('operationId'),
      source: searchParams.get('source'),
      search: searchParams.get('search'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    });

    const logService = new LogService();
    const result = await logService.getLogs(queryParams);

    logApiRequest(request, startTime);
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'Failed to get logs');
  }
}
