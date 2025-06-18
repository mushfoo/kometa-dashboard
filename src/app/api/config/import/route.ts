import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import yaml from 'yaml';

// Store for temporary import data
const importStore = new Map();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validExtensions = ['.yml', '.yaml', '.json'];
    const fileExtension = path.extname(file.name).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only YAML and JSON files are supported.' },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    if (!content.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Parse content based on file type
    let parsedConfig: any;
    try {
      if (fileExtension === '.json') {
        parsedConfig = JSON.parse(content);
      } else {
        parsedConfig = yaml.parse(content);
      }
    } catch (parseError) {
      return NextResponse.json(
        {
          error: 'Failed to parse file content',
          message:
            parseError instanceof Error ? parseError.message : 'Invalid format',
        },
        { status: 400 }
      );
    }

    // Validate configuration structure
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!parsedConfig || typeof parsedConfig !== 'object') {
      errors.push('Configuration must be a valid object');
    } else {
      // Remove export metadata if present
      if (parsedConfig._export_info) {
        delete parsedConfig._export_info;
      }

      // Basic structure validation
      if (!parsedConfig.plex) {
        errors.push('Plex configuration is required');
      } else {
        if (!parsedConfig.plex.url) {
          errors.push('Plex URL is required');
        }
        // Token might be missing if exported without keys
        if (!parsedConfig.plex.token) {
          warnings.push(
            "Plex token is missing - you'll need to configure it manually"
          );
        }
      }

      if (!parsedConfig.libraries) {
        warnings.push('No libraries configuration found');
      } else if (typeof parsedConfig.libraries !== 'object') {
        errors.push('Libraries configuration must be an object');
      }

      // Check for encrypted values
      const checkEncrypted = (obj: any, path: string = '') => {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string' && value.startsWith('enc:')) {
            warnings.push(
              `Encrypted value found at ${path}${key} - will be preserved`
            );
          } else if (typeof value === 'object' && value !== null) {
            checkEncrypted(value, `${path}${key}.`);
          }
        }
      };

      checkEncrypted(parsedConfig);
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Configuration validation failed with ${errors.length} error(s)`,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    }

    // Store the parsed config temporarily
    const importId = Date.now().toString();
    importStore.set(importId, parsedConfig);

    // Clean up old imports (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id] of importStore) {
      if (parseInt(id) < oneHourAgo) {
        importStore.delete(id);
      }
    }

    // Create a preview of the configuration
    const preview = {
      plex: {
        url: parsedConfig.plex?.url || 'Not configured',
        token: parsedConfig.plex?.token ? '***configured***' : 'Not configured',
      },
      libraries: parsedConfig.libraries
        ? Object.keys(parsedConfig.libraries)
        : [],
      tmdb: parsedConfig.tmdb?.apikey ? 'Configured' : 'Not configured',
      trakt: parsedConfig.trakt?.client_id ? 'Configured' : 'Not configured',
      settings: parsedConfig.settings ? 'Included' : 'Not included',
    };

    return NextResponse.json({
      success: true,
      message:
        warnings.length > 0
          ? `Configuration is valid with ${warnings.length} warning(s)`
          : 'Configuration is valid and ready to import',
      warnings: warnings.length > 0 ? warnings : undefined,
      preview,
      importId,
    });
  } catch (error) {
    console.error('Import analysis failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze import file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
