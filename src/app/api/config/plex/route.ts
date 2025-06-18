import { NextRequest, NextResponse } from 'next/server';
import { plexConfigFormSchema } from '@/lib/schemas/forms';
import { ConfigService } from '@/lib/ConfigService';
import { z } from 'zod';

export async function GET() {
  try {
    const configService = new ConfigService();
    const config = await configService.getConfig();

    if (!config || !config.plex) {
      return NextResponse.json({ url: '', token: '', selectedLibraries: [] });
    }

    return NextResponse.json({
      url: config.plex.url || '',
      token: config.plex.token || '',
      selectedLibraries: config.libraries ? Object.keys(config.libraries) : [],
    });
  } catch (error) {
    console.error('Failed to load Plex configuration:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = plexConfigFormSchema.parse(body);

    const configService = new ConfigService();
    const config = await configService.getConfig();

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Update Plex configuration
    config.plex = {
      url: validatedData.url,
      token: validatedData.token,
      timeout: 60,
    };

    // Update selected libraries if provided
    if (validatedData.selectedLibraries) {
      // Store existing libraries to preserve configurations
      const existingLibraries = config.libraries || {};

      // Convert array to object format that Kometa expects
      config.libraries = {};
      for (const libraryName of validatedData.selectedLibraries) {
        // Preserve existing library configuration if it exists
        const existing = existingLibraries[libraryName];
        config.libraries[libraryName] = existing || {
          operations: {
            assets_for_all: false,
            delete_collections: false,
            mass_critic_rating_update: false,
            split_duplicates: false,
          },
        };
      }
    }

    await configService.updateConfig(config);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save Plex configuration:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}
