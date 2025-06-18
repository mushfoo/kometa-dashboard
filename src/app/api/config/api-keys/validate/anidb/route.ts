import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const anidbValidationSchema = z.object({
  client: z.string().min(1),
  version: z.string().min(1),
  language: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      client,
      version,
      language = 'en',
    } = anidbValidationSchema.parse(body);

    // AniDB doesn't have a direct validation endpoint
    // We validate format requirements
    if (client.length < 3) {
      return NextResponse.json({
        service: 'anidb',
        valid: false,
        message: 'Client name should be at least 3 characters long.',
      });
    }

    // Version should be a number
    if (!/^\d+$/.test(version)) {
      return NextResponse.json({
        service: 'anidb',
        valid: false,
        message: 'Version should be a number (e.g., 1, 2, 3).',
      });
    }

    // Language should be a 2-letter code
    if (language && !/^[a-z]{2}$/i.test(language)) {
      return NextResponse.json({
        service: 'anidb',
        valid: false,
        message: 'Language should be a 2-letter code (e.g., en, ja, de).',
      });
    }

    return NextResponse.json({
      service: 'anidb',
      valid: true,
      message:
        "AniDB configuration appears valid. Make sure you've registered your client at anidb.net.",
    });
  } catch (error) {
    console.error('AniDB validation failed:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        service: 'anidb',
        valid: false,
        message: 'Invalid configuration format',
      });
    }

    return NextResponse.json({
      service: 'anidb',
      valid: false,
      message: 'Failed to validate AniDB configuration.',
    });
  }
}
