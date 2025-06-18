import { NextRequest, NextResponse } from 'next/server';
import { plexConnectionFormSchema } from '@/lib/schemas/forms';
import { ConfigService } from '@/lib/ConfigService';
import { z } from 'zod';

const plexConfigSchema = plexConnectionFormSchema.extend({
  selectedLibraries: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    const configService = new ConfigService();
    const config = await configService.getConfig();

    if (!config.plex) {
      return NextResponse.json({ url: '', token: '', selectedLibraries: [] });
    }

    return NextResponse.json({
      url: config.plex.url || '',
      token: config.plex.token || '',
      selectedLibraries: config.libraries?.map((lib) => lib.library_name) || [],
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
    const validatedData = plexConfigSchema.parse(body);

    const configService = new ConfigService();
    const config = await configService.getConfig();

    // Update Plex configuration
    config.plex = {
      url: validatedData.url,
      token: validatedData.token,
      timeout: 60,
      db_cache: 4096,
      clean_bundles: true,
      empty_trash: true,
      optimize: true,
    };

    // Update selected libraries if provided
    if (validatedData.selectedLibraries) {
      // Preserve existing library configurations but update selection
      config.libraries = validatedData.selectedLibraries.map((libraryName) => {
        const existing = config.libraries?.find(
          (lib) => lib.library_name === libraryName
        );
        return (
          existing || {
            library_name: libraryName,
            operations: {
              assets_for_all: false,
              delete_collections: false,
              mass_critic_rating_update: false,
              split_duplicates: false,
            },
          }
        );
      });
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
