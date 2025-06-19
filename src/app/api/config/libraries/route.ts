import { NextRequest, NextResponse } from 'next/server';
import { librarySettingsFormSchema } from '@/lib/schemas/forms';
import { ConfigService } from '@/lib/ConfigService';
import { z } from 'zod';

export async function GET() {
  try {
    const configService = new ConfigService();
    const config = await configService.getConfig();

    if (!config || !config.libraries) {
      return NextResponse.json([]);
    }

    // Handle both array and object formats for libraries
    let librariesArray: any[] = [];
    if (Array.isArray(config.libraries)) {
      librariesArray = config.libraries;
    } else if (typeof config.libraries === 'object') {
      // Convert object to array
      librariesArray = Object.entries(config.libraries).map(
        ([name, libConfig]: [string, any]) => ({
          library_name: name,
          ...libConfig,
        })
      );
    }

    if (librariesArray.length === 0) {
      return NextResponse.json([]);
    }

    // Transform config libraries to form format
    const libraries = librariesArray.map((lib: any) => ({
      library_name: lib.library_name,
      type: lib.library_type || 'movie',
      operations: {
        assets_for_all: lib.operations?.assets_for_all || false,
        delete_collections: lib.operations?.delete_collections || false,
        mass_critic_rating_update:
          lib.operations?.mass_critic_rating_update || false,
        split_duplicates: lib.operations?.split_duplicates || false,
      },
      scan_interval: lib.scan_interval,
      scanner_threads: lib.scanner_threads,
      collection_refresh_interval: lib.collection_refresh_interval,
      delete_unmanaged_collections: lib.delete_unmanaged_collections,
      delete_unmanaged_assets: lib.delete_unmanaged_assets,
    }));

    return NextResponse.json(libraries);
  } catch (error) {
    console.error('Failed to load library settings:', error);
    return NextResponse.json(
      { error: 'Failed to load library settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = librarySettingsFormSchema.parse(body);

    const configService = new ConfigService();
    const config = await configService.getConfig();

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Update library configurations
    config.libraries = validatedData.libraries.map((lib) => ({
      library_name: lib.library_name,
      library_type: lib.type,
      operations: {
        assets_for_all: lib.operations.assets_for_all,
        delete_collections: lib.operations.delete_collections,
        mass_critic_rating_update: lib.operations.mass_critic_rating_update,
        split_duplicates: lib.operations.split_duplicates,
      },
      scan_interval: lib.scan_interval || validatedData.settings.scan_interval,
      scanner_threads:
        lib.scanner_threads || validatedData.settings.scanner_threads,
      collection_refresh_interval:
        lib.collection_refresh_interval ||
        validatedData.settings.collection_refresh_interval,
      delete_unmanaged_collections:
        lib.delete_unmanaged_collections !== undefined
          ? lib.delete_unmanaged_collections
          : validatedData.settings.delete_unmanaged_collections,
      delete_unmanaged_assets:
        lib.delete_unmanaged_assets !== undefined
          ? lib.delete_unmanaged_assets
          : validatedData.settings.delete_unmanaged_assets,
      // Preserve existing collections if they exist
      collections:
        config.libraries?.find(
          (existing: any) => existing.library_name === lib.library_name
        )?.collections || [],
    }));

    // Update global settings
    config.settings = {
      ...config.settings,
    };

    await configService.updateConfig(config);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save library settings:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid library settings format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save library settings' },
      { status: 500 }
    );
  }
}
