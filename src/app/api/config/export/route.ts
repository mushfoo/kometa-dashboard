import { NextRequest, NextResponse } from 'next/server';
import { ConfigService } from '@/lib/ConfigService';
import { EncryptionService } from '@/lib/EncryptionService';
import { z } from 'zod';
import yaml from 'yaml';

const exportOptionsSchema = z.object({
  includeKeys: z.boolean().default(false),
  includeSettings: z.boolean().default(true),
  format: z.enum(['yaml', 'json']).default('yaml'),
  filename: z.string().default('kometa-config'),
});

export async function GET() {
  try {
    const configService = new ConfigService();
    const config = await configService.getConfig();

    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to load configuration for export:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const options = exportOptionsSchema.parse(body);

    const configService = new ConfigService();
    const encryptionService = EncryptionService.getInstance();
    const config = await configService.getConfig();

    // Create a clean export copy
    const exportConfig: any = { ...config };

    // Handle API keys
    if (!options.includeKeys) {
      // Remove all API keys
      if (exportConfig.tmdb?.apikey) {
        delete exportConfig.tmdb.apikey;
      }
      if (exportConfig.trakt?.client_id) {
        delete exportConfig.trakt.client_id;
      }
      if (exportConfig.trakt?.client_secret) {
        delete exportConfig.trakt.client_secret;
      }
      if (exportConfig.imdb?.apikey) {
        delete exportConfig.imdb.apikey;
      }
      if (exportConfig.plex?.token) {
        delete exportConfig.plex.token;
      }
    } else {
      // Ensure keys are encrypted for export
      if (
        exportConfig.tmdb?.apikey &&
        !exportConfig.tmdb.apikey.startsWith('enc:')
      ) {
        exportConfig.tmdb.apikey = await encryptionService.encrypt(
          exportConfig.tmdb.apikey
        );
      }
      if (
        exportConfig.trakt?.client_id &&
        !exportConfig.trakt.client_id.startsWith('enc:')
      ) {
        exportConfig.trakt.client_id = await encryptionService.encrypt(
          exportConfig.trakt.client_id
        );
      }
      if (
        exportConfig.trakt?.client_secret &&
        !exportConfig.trakt.client_secret.startsWith('enc:')
      ) {
        exportConfig.trakt.client_secret = await encryptionService.encrypt(
          exportConfig.trakt.client_secret
        );
      }
      if (
        exportConfig.imdb?.apikey &&
        !exportConfig.imdb.apikey.startsWith('enc:')
      ) {
        exportConfig.imdb.apikey = await encryptionService.encrypt(
          exportConfig.imdb.apikey
        );
      }
      if (
        exportConfig.plex?.token &&
        !exportConfig.plex.token.startsWith('enc:')
      ) {
        exportConfig.plex.token = await encryptionService.encrypt(
          exportConfig.plex.token
        );
      }
    }

    // Handle settings
    if (!options.includeSettings) {
      delete exportConfig.settings;
    }

    // Add export metadata
    exportConfig._export_info = {
      exported_at: new Date().toISOString(),
      exported_by: 'Kometa Dashboard',
      version: '1.0.0',
      includes_keys: options.includeKeys,
      includes_settings: options.includeSettings,
    };

    // Generate content based on format
    let content: string;
    let contentType: string;

    if (options.format === 'yaml') {
      content = yaml.stringify(exportConfig, {
        indent: 2,
        lineWidth: 120,
        minContentWidth: 80,
      });
      contentType = 'text/yaml';
    } else {
      content = JSON.stringify(exportConfig, null, 2);
      contentType = 'application/json';
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${options.filename}.${options.format}"`,
      },
    });
  } catch (error) {
    console.error('Failed to export configuration:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid export options', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to export configuration' },
      { status: 500 }
    );
  }
}
