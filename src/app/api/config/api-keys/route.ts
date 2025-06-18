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
        pin: config.trakt?.pin || '',
      },
      imdb: config.imdb?.apikey
        ? await encryptionService.maskKey(config.imdb.apikey)
        : '',
      anidb: {
        client: config.anidb?.client || '',
        version: config.anidb?.version || '',
        language: config.anidb?.language || 'en',
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

    // Update TMDb configuration
    if (validatedData.tmdb) {
      config.tmdb = {
        ...config.tmdb,
        apikey: await encryptionService.encrypt(validatedData.tmdb),
        language: config.tmdb?.language || 'en',
        cache_expiration: config.tmdb?.cache_expiration || 60,
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
        pin: validatedData.trakt.pin,
        authorization: config.trakt?.authorization || {},
      };
    }

    // Update IMDb configuration (optional)
    if (validatedData.imdb) {
      config.imdb = {
        ...config.imdb,
        apikey: await encryptionService.encrypt(validatedData.imdb),
        cache_expiration: config.imdb?.cache_expiration || 60,
      };
    }

    // Update AniDB configuration
    if (validatedData.anidb?.client && validatedData.anidb?.version) {
      config.anidb = {
        ...config.anidb,
        client: validatedData.anidb.client,
        version: validatedData.anidb.version,
        language: validatedData.anidb.language || 'en',
        cache_expiration: config.anidb?.cache_expiration || 60,
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
