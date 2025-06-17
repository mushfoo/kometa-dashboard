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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body = await validateJsonBody(request);

    // Validate the configuration
    const validation = await configService.validateConfig(body);

    const result = {
      valid: validation.valid,
      errors: validation.errors || [],
      warnings: validation.warnings || [],
      summary: {
        hasErrors: !!validation.errors && validation.errors.length > 0,
        hasWarnings: !!validation.warnings && validation.warnings.length > 0,
        errorCount: validation.errors?.length || 0,
        warningCount: validation.warnings?.length || 0,
      },
    };

    logApiRequest(request, startTime);

    // Return 200 for both valid and invalid configs (the validation result indicates validity)
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error, 'Failed to validate configuration');
  }
}
