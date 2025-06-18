import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import yaml from 'yaml';

const yamlValidationSchema = z.object({
  yaml: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yaml: yamlContent } = yamlValidationSchema.parse(body);

    if (!yamlContent.trim()) {
      return NextResponse.json({
        valid: false,
        message: 'YAML content is empty',
        errors: ['Configuration cannot be empty'],
      });
    }

    // Parse YAML
    let parsedConfig;
    try {
      parsedConfig = yaml.parse(yamlContent);
    } catch (yamlError) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid YAML syntax',
        errors: [
          yamlError instanceof Error
            ? yamlError.message
            : 'YAML parsing failed',
        ],
      });
    }

    // Validate structure
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!parsedConfig || typeof parsedConfig !== 'object') {
      errors.push('Configuration must be a valid YAML object');
    } else {
      // Check Plex configuration
      if (!parsedConfig.plex) {
        errors.push('Plex configuration is required');
      } else {
        if (!parsedConfig.plex.url) {
          errors.push('Plex URL is required');
        }
        if (!parsedConfig.plex.token) {
          errors.push('Plex token is required');
        }
      }

      // Check libraries
      if (!parsedConfig.libraries) {
        errors.push('Libraries configuration is required');
      } else if (typeof parsedConfig.libraries !== 'object') {
        errors.push('Libraries must be an object');
      } else if (Object.keys(parsedConfig.libraries).length === 0) {
        warnings.push('No libraries configured');
      }

      // Check for common API configurations
      if (!parsedConfig.tmdb) {
        warnings.push(
          'TMDb API configuration is recommended for better metadata'
        );
      }

      // Validate library structure
      if (
        parsedConfig.libraries &&
        typeof parsedConfig.libraries === 'object'
      ) {
        for (const [libraryName, libraryConfig] of Object.entries(
          parsedConfig.libraries
        )) {
          if (typeof libraryConfig !== 'object' || libraryConfig === null) {
            errors.push(
              `Library "${libraryName}" must be a valid configuration object`
            );
          }
        }
      }

      // Check for deprecated or unknown top-level keys
      const knownKeys = [
        'plex',
        'tmdb',
        'trakt',
        'imdb',
        'anidb',
        'omdb',
        'mdblist',
        'letterboxd',
        'libraries',
        'settings',
        'webhooks',
        'github',
        'run_order',
        'runorder',
      ];

      const unknownKeys = Object.keys(parsedConfig).filter(
        (key) => !knownKeys.includes(key)
      );
      if (unknownKeys.length > 0) {
        warnings.push(`Unknown configuration keys: ${unknownKeys.join(', ')}`);
      }
    }

    const isValid = errors.length === 0;
    let message = '';

    if (isValid) {
      if (warnings.length > 0) {
        message = `Configuration is valid with ${warnings.length} warning(s)`;
      } else {
        message = 'Configuration is valid and ready to use';
      }
    } else {
      message = `Configuration has ${errors.length} error(s)`;
    }

    return NextResponse.json({
      valid: isValid,
      message,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error('YAML validation failed:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid request format',
        errors: ['Request must contain valid YAML content'],
      });
    }

    return NextResponse.json({
      valid: false,
      message: 'Validation failed due to internal error',
      errors: ['An unexpected error occurred during validation'],
    });
  }
}
