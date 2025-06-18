import { NextRequest, NextResponse } from 'next/server';
import { ConfigService } from '@/lib/ConfigService';
import { z } from 'zod';
import yaml from 'yaml';

const yamlRequestSchema = z.object({
  yaml: z.string(),
});

export async function GET() {
  try {
    const configService = new ConfigService();
    const config = await configService.getConfig();

    // Convert config to YAML
    const yamlContent = yaml.stringify(config, {
      indent: 2,
      lineWidth: 120,
      minContentWidth: 80,
    });

    return NextResponse.json({ yaml: yamlContent });
  } catch (error) {
    console.error('Failed to load YAML configuration:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yaml: yamlContent } = yamlRequestSchema.parse(body);

    // Parse YAML to validate it
    let parsedConfig;
    try {
      parsedConfig = yaml.parse(yamlContent);
    } catch (yamlError) {
      return NextResponse.json(
        {
          error: 'Invalid YAML format',
          message:
            yamlError instanceof Error
              ? yamlError.message
              : 'YAML parsing failed',
        },
        { status: 400 }
      );
    }

    // Basic validation of required fields
    if (parsedConfig && typeof parsedConfig === 'object') {
      const errors: string[] = [];

      // Check for Plex configuration
      if (
        !parsedConfig.plex ||
        !parsedConfig.plex.url ||
        !parsedConfig.plex.token
      ) {
        errors.push(
          'Plex configuration is missing or incomplete (url and token required)'
        );
      }

      // Check for at least one library
      if (
        !parsedConfig.libraries ||
        Object.keys(parsedConfig.libraries).length === 0
      ) {
        errors.push('At least one library must be configured');
      }

      if (errors.length > 0) {
        return NextResponse.json(
          {
            error: 'Configuration validation failed',
            details: errors,
          },
          { status: 400 }
        );
      }
    }

    const configService = new ConfigService();
    await configService.updateConfig(parsedConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save YAML configuration:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}
