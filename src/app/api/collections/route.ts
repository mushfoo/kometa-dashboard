import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, logApiRequest } from '@/lib/api-utils';
import { CollectionStorageService } from '@/lib/CollectionStorageService';
import { z } from 'zod';

// Request schema for creating collections
const CreateCollectionRequest = z.object({
  name: z.string().min(1, 'Collection name is required'),
  description: z.string().optional(),
  type: z.enum(['smart', 'manual']),
  filters: z.any().optional(),
  metadata: z.record(z.any()).optional(),
});

const collectionStorage = new CollectionStorageService();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const collections = await collectionStorage.loadCollections();

    logApiRequest(request, startTime);
    return NextResponse.json({
      collections,
      total: collections.length,
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to get collections');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate request
    const parseResult = CreateCollectionRequest.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid collection data',
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    // Save collection
    const savedCollection = await collectionStorage.saveCollection(
      parseResult.data
    );

    logApiRequest(request, startTime);
    return NextResponse.json(
      {
        collection: savedCollection,
        message: 'Collection created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    return createErrorResponse(error, 'Failed to create collection');
  }
}
