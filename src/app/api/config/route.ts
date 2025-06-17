import { NextRequest, NextResponse } from 'next/server';
import {
  createErrorResponse,
  logApiRequest,
  validateJsonBody,
} from '@/lib/api-utils';
import { createConfigService } from '@/lib/ConfigService';
import path from 'path';

const configService = createConfigService(
  process.env.STORAGE_PATH || path.join(process.cwd(), 'storage')
);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const config = await configService.getConfig();
    const status = await configService.getConfigStatus();

    const result = {
      config,
      status,
    };

    logApiRequest(request, startTime);
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'Failed to get configuration');
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body = await validateJsonBody(request);

    // Validate the configuration first
    const validation = await configService.validateConfig(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Configuration validation failed',
          details: {
            errors: validation.errors,
            warnings: validation.warnings,
          },
        },
        { status: 400 }
      );
    }

    // Update the configuration
    await configService.updateConfig(body as any);

    // Get updated status
    const status = await configService.getConfigStatus();

    const result = {
      message: 'Configuration updated successfully',
      status,
      warnings: validation.warnings,
    };

    logApiRequest(request, startTime);
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'Failed to update configuration');
  }
}
