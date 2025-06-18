import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const imdbValidationSchema = z.object({
  api_key: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { api_key } = imdbValidationSchema.parse(body);

    if (!api_key) {
      return NextResponse.json({
        service: 'imdb',
        valid: true,
        message: 'IMDb API key is optional. Kometa can work without it.',
      });
    }

    // IMDb doesn't have a public API validation endpoint
    // We can only check format
    if (api_key.length < 10) {
      return NextResponse.json({
        service: 'imdb',
        valid: false,
        message: 'IMDb API key appears too short. Please check your key.',
      });
    }

    return NextResponse.json({
      service: 'imdb',
      valid: true,
      message: 'IMDb API key format appears valid.',
    });
  } catch (error) {
    console.error('IMDb validation failed:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        service: 'imdb',
        valid: false,
        message: 'Invalid API key format',
      });
    }

    return NextResponse.json({
      service: 'imdb',
      valid: false,
      message: 'Failed to validate IMDb API key.',
    });
  }
}
