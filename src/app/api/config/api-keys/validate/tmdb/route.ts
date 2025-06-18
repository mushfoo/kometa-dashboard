import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const tmdbValidationSchema = z.object({
  api_key: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { api_key } = tmdbValidationSchema.parse(body);

    // Test TMDb API key
    const response = await fetch(
      `https://api.themoviedb.org/3/configuration?api_key=${api_key}`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({
          service: 'tmdb',
          valid: false,
          message: 'Invalid API key. Please check your TMDb API key.',
        });
      }
      throw new Error(`TMDb API returned status ${response.status}`);
    }

    await response.json();

    return NextResponse.json({
      service: 'tmdb',
      valid: true,
      message: 'TMDb API key is valid and working correctly.',
    });
  } catch (error) {
    console.error('TMDb validation failed:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        service: 'tmdb',
        valid: false,
        message: 'Invalid API key format',
      });
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json({
          service: 'tmdb',
          valid: false,
          message: 'Connection timeout. Please check your internet connection.',
        });
      }

      return NextResponse.json({
        service: 'tmdb',
        valid: false,
        message: error.message,
      });
    }

    return NextResponse.json({
      service: 'tmdb',
      valid: false,
      message: 'Failed to validate TMDb API key.',
    });
  }
}
