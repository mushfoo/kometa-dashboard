import { NextRequest, NextResponse } from 'next/server';
import { apiKeysFormSchema } from '@/lib/schemas/forms';
import { ConfigService } from '@/lib/ConfigService';
import { z } from 'zod';
import { EncryptionService } from '@/lib/EncryptionService';

export async function GET() {
  try {
    const configService = new ConfigService();
    const config = await configService.getConfig();
    const encryptionService = EncryptionService.getInstance();

    if (!config) {
      return NextResponse.json({
        tmdb: '',
        trakt: { client_id: '', client_secret: '', pin: '' },
        imdb: '',
        anidb: { client: '', version: '', language: 'en' },
      });
    }

    // Return decrypted keys (but still masked for display)
    const keys = {
      tmdb: config.tmdb?.apikey
        ? await encryptionService.maskKey(config.tmdb.apikey)
        : '',
      trakt: {
        client_id: config.trakt?.client_id
          ? await encryptionService.maskKey(config.trakt.client_id)
          : '',
        client_secret: config.trakt?.client_secret
          ? await encryptionService.maskKey(config.trakt.client_secret)
          : '',
        pin: '',
      },
      imdb: config.imdb?.apikey
        ? await encryptionService.maskKey(config.imdb.apikey)
        : '',
      anidb: {
        client: '',
        version: '',
        language: 'en',
      },
    };

    return NextResponse.json(keys);
  } catch (error) {
    console.error('Failed to load API keys:', error);
    return NextResponse.json(
      { error: 'Failed to load API keys' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = apiKeysFormSchema.parse(body);

    const configService = new ConfigService();
    const encryptionService = EncryptionService.getInstance();
    const config = await configService.getConfig();

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Update TMDb configuration
    if (validatedData.tmdb) {
      config.tmdb = {
        ...config.tmdb,
        apikey: await encryptionService.encrypt(validatedData.tmdb),
        language: config.tmdb?.language || 'en',
        region: config.tmdb?.region || '',
      };
    }

    // Update Trakt configuration
    if (validatedData.trakt?.client_id && validatedData.trakt?.client_secret) {
      config.trakt = {
        ...config.trakt,
        client_id: await encryptionService.encrypt(
          validatedData.trakt.client_id
        ),
        client_secret: await encryptionService.encrypt(
          validatedData.trakt.client_secret
        ),
        authorization: config.trakt?.authorization,
      };
    }

    // Update IMDb configuration (optional)
    if (validatedData.imdb) {
      config.imdb = {
        ...config.imdb,
        apikey: await encryptionService.encrypt(validatedData.imdb),
      };
    }

    await configService.updateConfig(config);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save API keys:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid API keys format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save API keys' },
      { status: 500 }
    );
  }
}
