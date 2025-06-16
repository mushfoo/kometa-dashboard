import { NextRequest, NextResponse } from 'next/server';

export interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

export class ApiException extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status: number = 500, details?: unknown) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.details = details;
  }
}

export function createErrorResponse(
  error: unknown,
  defaultMessage: string = 'Internal server error'
): NextResponse {
  if (error instanceof ApiException) {
    return NextResponse.json(
      {
        error: error.message,
        details: error.details,
      },
      { status: error.status }
    );
  }

  if (error instanceof Error) {
    console.error(`API Error: ${error.message}`, error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.error('Unknown API Error:', error);
  return NextResponse.json({ error: defaultMessage }, { status: 500 });
}

export function logApiRequest(request: NextRequest, startTime: number): void {
  const duration = Date.now() - startTime;
  const userAgent = request.headers.get('user-agent') || 'unknown';

  console.log({
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    userAgent,
    duration: `${duration}ms`,
  });
}

export async function validateJsonBody<T>(
  request: NextRequest,
  // eslint-disable-next-line no-unused-vars
  validator?: (body: unknown) => T
): Promise<T> {
  try {
    const body = await request.json();

    if (validator) {
      return validator(body);
    }

    return body as T;
  } catch (error) {
    throw new ApiException('Invalid JSON body', 400, error);
  }
}
