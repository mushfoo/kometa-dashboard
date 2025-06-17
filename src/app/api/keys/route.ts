import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  apiKeyService,
  SUPPORTED_SERVICES,
  type SupportedService,
} from '@/lib/ApiKeyService';
import { createErrorResponse, validateJsonBody } from '@/lib/api-utils';

// Request schemas
const addKeyRequestSchema = z.object({
  service: z.enum(['tmdb', 'trakt', 'imdb']),
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

// Response types
interface ConfiguredService {
  service: SupportedService;
  hasKey: boolean;
  lastTested?: string;
  isValid?: boolean;
  serviceInfo?: {
    name?: string;
    features?: string[];
  };
}

interface AddKeyResponse {
  message: string;
  service: SupportedService;
  isValid?: boolean;
  serviceInfo?: {
    name?: string;
    features?: string[];
  };
}

/**
 * GET /api/keys
 * List all configured services and their status (without exposing actual keys)
 */
export async function GET(): Promise<NextResponse> {
  try {
    const configuredServices = await apiKeyService.getConfiguredServices();

    const serviceStatuses: ConfiguredService[] = await Promise.all(
      SUPPORTED_SERVICES.map(async (service) => {
        const hasKey = configuredServices.includes(service);

        if (!hasKey) {
          return {
            service,
            hasKey: false,
          };
        }

        // Test the key to get current status
        try {
          const testResult = await apiKeyService.testKey(service);
          return {
            service,
            hasKey: true,
            lastTested: new Date().toISOString(),
            isValid: testResult.valid,
            serviceInfo: testResult.serviceInfo,
          };
        } catch (error) {
          return {
            service,
            hasKey: true,
            lastTested: new Date().toISOString(),
            isValid: false,
          };
        }
      })
    );

    return NextResponse.json({
      data: serviceStatuses,
      message: 'API key statuses retrieved successfully',
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * POST /api/keys
 * Add a new API key for a service
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await validateJsonBody(request, (data) =>
      addKeyRequestSchema.parse(data)
    );
    const { service, keyData, testConnection } = body;

    // Store the API key
    await apiKeyService.storeKey(service, keyData);

    let testResult;
    if (testConnection) {
      // Test the connection
      testResult = await apiKeyService.testKey(service, keyData);

      if (!testResult.valid) {
        // Still store the key but warn about the test failure
        console.warn(
          `API key stored for ${service} but connection test failed:`,
          testResult.error
        );
      }
    }

    const response: AddKeyResponse = {
      message: `API key for ${service} ${
        testConnection
          ? testResult?.valid
            ? 'added and validated successfully'
            : 'added but validation failed'
          : 'added successfully'
      }`,
      service,
      isValid: testResult?.valid,
      serviceInfo: testResult?.serviceInfo,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
