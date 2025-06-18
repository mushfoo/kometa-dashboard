import { NextRequest, NextResponse } from 'next/server';
import { plexConnectionFormSchema } from '@/lib/schemas/forms';
import { z } from 'zod';

// Schema for testing Plex connection
const plexTestSchema = plexConnectionFormSchema.pick({
  url: true,
  token: true,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = plexTestSchema.parse(body);

    // Test Plex connection
    const connectionResult = await testPlexConnection(
      validatedData.url,
      validatedData.token
    );

    if (!connectionResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: connectionResult.error,
          details: connectionResult.details,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      serverInfo: connectionResult.serverInfo,
      libraries: connectionResult.libraries,
    });
  } catch (error) {
    console.error('Failed to test Plex connection:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid connection data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to test connection' },
      { status: 500 }
    );
  }
}

async function testPlexConnection(url: string, token: string) {
  try {
    // Clean up URL - remove trailing slash
    const cleanUrl = url.replace(/\/$/, '');

    // Test basic connectivity to Plex server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const serverResponse = await fetch(`${cleanUrl}/`, {
      method: 'GET',
      headers: {
        'X-Plex-Token': token,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!serverResponse.ok) {
      return {
        success: false,
        error: 'Failed to connect to Plex server',
        details: `HTTP ${serverResponse.status}: ${serverResponse.statusText}`,
      };
    }

    // Get server information
    const serverInfo = await serverResponse.json();

    // Get libraries
    const librariesController = new AbortController();
    const librariesTimeoutId = setTimeout(
      () => librariesController.abort(),
      10000
    );

    const librariesResponse = await fetch(`${cleanUrl}/library/sections`, {
      method: 'GET',
      headers: {
        'X-Plex-Token': token,
        Accept: 'application/json',
      },
      signal: librariesController.signal,
    });

    clearTimeout(librariesTimeoutId);

    if (!librariesResponse.ok) {
      return {
        success: false,
        error: 'Connected to server but failed to retrieve libraries',
        details: `HTTP ${librariesResponse.status}: ${librariesResponse.statusText}`,
      };
    }

    const librariesData = await librariesResponse.json();

    // Extract library information
    const libraries =
      librariesData.MediaContainer?.Directory?.map((lib: any) => ({
        key: lib.key,
        title: lib.title,
        type: lib.type,
        updatedAt: lib.updatedAt,
      })) || [];

    return {
      success: true,
      serverInfo: {
        friendlyName:
          serverInfo.MediaContainer?.friendlyName || 'Unknown Server',
        version: serverInfo.MediaContainer?.version || 'Unknown',
        platform: serverInfo.MediaContainer?.platform || 'Unknown',
        machineIdentifier: serverInfo.MediaContainer?.machineIdentifier || '',
      },
      libraries,
    };
  } catch (error) {
    console.error('Plex connection test error:', error);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: 'Network error - unable to reach Plex server',
        details: 'Please check the URL and ensure the server is accessible',
      };
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Connection timeout',
        details: 'The Plex server did not respond within 10 seconds',
      };
    }

    return {
      success: false,
      error: 'Unexpected error during connection test',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
