import { NextRequest, NextResponse } from 'next/server';
import { plexConnectionFormSchema } from '@/lib/schemas/forms';
import { z } from 'zod';

interface PlexLibrary {
  key: string;
  title: string;
  type: 'movie' | 'show' | 'music' | 'photo';
  location: string[];
  scanner: string;
  agent: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = plexConnectionFormSchema.parse(body);

    // Test connection to Plex server
    const plexUrl = validatedData.url.replace(/\/$/, ''); // Remove trailing slash
    const testUrl = `${plexUrl}/library/sections?X-Plex-Token=${validatedData.token}`;

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({
          success: false,
          message:
            'Invalid Plex token. Please check your authentication token.',
        });
      }
      throw new Error(`Plex server returned status ${response.status}`);
    }

    const data = await response.json();

    // Parse library data
    const libraries: PlexLibrary[] =
      data.MediaContainer?.Directory?.map((lib: any) => ({
        key: lib.key,
        title: lib.title,
        type: lib.type,
        location: lib.Location?.map((loc: any) => loc.path) || [],
        scanner: lib.scanner || 'Unknown',
        agent: lib.agent || 'Unknown',
      })) || [];

    // Filter to only movie and show libraries (what Kometa supports)
    const supportedLibraries = libraries.filter(
      (lib) => lib.type === 'movie' || lib.type === 'show'
    );

    return NextResponse.json({
      success: true,
      message: `Successfully connected to Plex server. Found ${supportedLibraries.length} supported libraries.`,
      libraries: supportedLibraries,
    });
  } catch (error) {
    console.error('Plex connection test failed:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        message: 'Invalid configuration format',
      });
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          message:
            "Connection timeout. Please check your Plex server URL and ensure it's accessible.",
        });
      }

      if (error.message.includes('fetch')) {
        return NextResponse.json({
          success: false,
          message:
            'Failed to connect to Plex server. Please check the URL and ensure the server is running.',
        });
      }

      return NextResponse.json({
        success: false,
        message: error.message,
      });
    }

    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while testing the connection.',
    });
  }
}
