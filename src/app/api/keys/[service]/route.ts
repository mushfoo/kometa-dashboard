import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  apiKeyService,
  SUPPORTED_SERVICES,
  type SupportedService,
} from '@/lib/ApiKeyService';
import { createErrorResponse, validateJsonBody } from '@/lib/api-utils';

// Request schemas
const updateKeyRequestSchema = z.object({
  keyData: z.union([
    z.string(), // For TMDb and IMDb
    z.object({
      // For Trakt
      clientId: z.string(),
      clientSecret: z.string(),
    }),
  ]),
  testConnection: z.boolean().optional().default(true),
});

// Removed unused testKeyRequestSchema - testing is handled without request body

// Helper function to validate service parameter
function validateService(service: string): SupportedService {
  if (!SUPPORTED_SERVICES.includes(service as SupportedService)) {
    throw new Error(
      `Unsupported service: ${service}. Supported services: ${SUPPORTED_SERVICES.join(', ')}`
    );
  }
  return service as SupportedService;
}

interface ServiceOperationResponse {
  message: string;
  service: SupportedService;
  isValid?: boolean;
  serviceInfo?: {
    name?: string;
    features?: string[];
  };
}

/**
 * GET /api/keys/[service]
 * Get status and test connectivity for a specific service (without exposing the actual key)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { service: string } }
): Promise<NextResponse> {
  try {
    const service = validateService(params.service);

    const hasKey = await apiKeyService.hasKey(service);

    if (!hasKey) {
      return NextResponse.json(
        {
          message: `No API key found for ${service}`,
          service,
          hasKey: false,
        },
        { status: 404 }
      );
    }

    // Test the key to get current status
    const testResult = await apiKeyService.testKey(service);

    return NextResponse.json({
      message: `API key status for ${service}`,
      service,
      hasKey: true,
      lastTested: new Date().toISOString(),
      isValid: testResult.valid,
      serviceInfo: testResult.serviceInfo,
      error: testResult.error,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * PUT /api/keys/[service]
 * Update an existing API key for a service
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { service: string } }
): Promise<NextResponse> {
  try {
    const service = validateService(params.service);
    const body = await validateJsonBody(request, (data) =>
      updateKeyRequestSchema.parse(data)
    );
    const { keyData, testConnection } = body;

    // Check if key already exists
    const hasExistingKey = await apiKeyService.hasKey(service);

    // Store the updated API key
    await apiKeyService.storeKey(service, keyData);

    let testResult;
    if (testConnection) {
      // Test the connection
      testResult = await apiKeyService.testKey(service, keyData);

      if (!testResult.valid) {
        console.warn(
          `API key updated for ${service} but connection test failed:`,
          testResult.error
        );
      }
    }

    const response: ServiceOperationResponse = {
      message: `API key for ${service} ${hasExistingKey ? 'updated' : 'created'}${
        testConnection
          ? testResult?.valid
            ? ' and validated successfully'
            : ' but validation failed'
          : ' successfully'
      }`,
      service,
      isValid: testResult?.valid,
      serviceInfo: testResult?.serviceInfo,
    };

    return NextResponse.json(response, { status: hasExistingKey ? 200 : 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * DELETE /api/keys/[service]
 * Remove an API key for a service
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { service: string } }
): Promise<NextResponse> {
  try {
    const service = validateService(params.service);

    const hasKey = await apiKeyService.hasKey(service);

    if (!hasKey) {
      return NextResponse.json(
        {
          message: `No API key found for ${service}`,
          service,
        },
        { status: 404 }
      );
    }

    // Delete the API key
    await apiKeyService.deleteKey(service);

    return NextResponse.json({
      message: `API key for ${service} removed successfully`,
      service,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * POST /api/keys/[service]
 * Test connection for an existing API key
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { service: string } }
): Promise<NextResponse> {
  try {
    const service = validateService(params.service);

    const hasKey = await apiKeyService.hasKey(service);

    if (!hasKey) {
      return NextResponse.json(
        {
          message: `No API key found for ${service}`,
          service,
        },
        { status: 404 }
      );
    }

    // Test the existing key
    const testResult = await apiKeyService.testKey(service);

    const response: ServiceOperationResponse = {
      message: `Connection test for ${service} ${testResult.valid ? 'successful' : 'failed'}`,
      service,
      isValid: testResult.valid,
      serviceInfo: testResult.serviceInfo,
    };

    return NextResponse.json(response, {
      status: testResult.valid ? 200 : 400,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
