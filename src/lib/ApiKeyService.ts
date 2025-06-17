import { z } from 'zod';
import { createTypedStorage } from './file-storage-service';

// Zod schemas for API key validation
const tmdbKeySchema = z
  .string()
  .regex(
    /^[a-f0-9]{32}$/,
    'TMDb API key must be a 32-character hexadecimal string'
  );

const traktKeySchema = z.object({
  clientId: z
    .string()
    .min(64, 'Trakt Client ID must be at least 64 characters'),
  clientSecret: z
    .string()
    .min(64, 'Trakt Client Secret must be at least 64 characters'),
});

const imdbKeySchema = z
  .string()
  .min(8, 'IMDb API key must be at least 8 characters');

// API key data types
export interface TraktCredentials {
  clientId: string;
  clientSecret: string;
}

export type ApiKeyData = string | TraktCredentials;

export interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
  serviceInfo?: {
    name?: string;
    version?: string;
    features?: string[];
  };
}

// Supported services
export const SUPPORTED_SERVICES = ['tmdb', 'trakt', 'imdb'] as const;
export type SupportedService = (typeof SUPPORTED_SERVICES)[number];

/**
 * Service for managing API keys for third-party services
 * Uses existing FileStorageService for JSON-based storage
 */
export class ApiKeyService {
  private readonly storage: ReturnType<typeof createTypedStorage>;

  constructor(basePath: string = './storage/keys') {
    this.storage = createTypedStorage(basePath, z.record(z.unknown()));
  }

  /**
   * Store an API key for a service
   */
  async storeKey(
    service: SupportedService,
    keyData: ApiKeyData
  ): Promise<void> {
    // Validate the key format before storing
    this.validateKeyFormat(service, keyData);

    const filename = `${service}-key.json`;
    await this.storage.write(filename, {
      keyData,
      storedAt: new Date().toISOString(),
    });
  }

  /**
   * Retrieve an API key for a service
   */
  async getKey(service: SupportedService): Promise<ApiKeyData | null> {
    const filename = `${service}-key.json`;
    const data = await this.storage.read(filename);

    if (!data || typeof data !== 'object' || !('keyData' in data)) {
      return null;
    }

    return data.keyData as ApiKeyData;
  }

  /**
   * Delete an API key for a service
   */
  async deleteKey(service: SupportedService): Promise<void> {
    const filename = `${service}-key.json`;
    await this.storage.delete(filename);
  }

  /**
   * Check if a service has an API key stored
   */
  async hasKey(service: SupportedService): Promise<boolean> {
    const filename = `${service}-key.json`;
    return await this.storage.exists(filename);
  }

  /**
   * List all services that have API keys configured
   */
  async getConfiguredServices(): Promise<SupportedService[]> {
    const files = await this.storage.list('', { extension: '.json' });
    return files
      .map((file) => file.replace('-key.json', ''))
      .filter((service): service is SupportedService =>
        SUPPORTED_SERVICES.includes(service as SupportedService)
      );
  }

  /**
   * Validate API key format for a specific service
   */
  private validateKeyFormat(
    service: SupportedService,
    keyData: ApiKeyData
  ): void {
    switch (service) {
      case 'tmdb':
        tmdbKeySchema.parse(keyData);
        break;
      case 'trakt':
        traktKeySchema.parse(keyData);
        break;
      case 'imdb':
        imdbKeySchema.parse(keyData);
        break;
      default:
        throw new Error(`Unsupported service: ${service}`);
    }
  }

  /**
   * Test an API key by making a real API call
   */
  async testKey(
    service: SupportedService,
    keyData?: ApiKeyData
  ): Promise<ApiKeyValidationResult> {
    try {
      const apiKey = keyData || (await this.getKey(service));

      if (!apiKey) {
        return { valid: false, error: 'No API key found for service' };
      }

      switch (service) {
        case 'tmdb':
          return await this.testTMDbKey(apiKey as string);
        case 'trakt':
          return await this.testTraktKey(apiKey as TraktCredentials);
        case 'imdb':
          return await this.testIMDbKey(apiKey as string);
        default:
          return { valid: false, error: `Unsupported service: ${service}` };
      }
    } catch (error) {
      return {
        valid: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Test TMDb API key
   */
  private async testTMDbKey(apiKey: string): Promise<ApiKeyValidationResult> {
    const response = await fetch(
      `https://api.themoviedb.org/3/configuration?api_key=${apiKey}`
    );

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'Invalid TMDb API key' };
      }
      return { valid: false, error: `TMDb API error: ${response.status}` };
    }

    await response.json(); // Parse response but don't use data for validation
    return {
      valid: true,
      serviceInfo: {
        name: 'The Movie Database (TMDb)',
        features: ['Movies', 'TV Shows', 'People', 'Images'],
      },
    };
  }

  /**
   * Test Trakt API key
   */
  private async testTraktKey(
    credentials: TraktCredentials
  ): Promise<ApiKeyValidationResult> {
    const response = await fetch('https://api.trakt.tv/movies/trending', {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': credentials.clientId,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'Invalid Trakt API credentials' };
      }
      return { valid: false, error: `Trakt API error: ${response.status}` };
    }

    return {
      valid: true,
      serviceInfo: {
        name: 'Trakt',
        features: ['Movies', 'TV Shows', 'Lists', 'Ratings'],
      },
    };
  }

  /**
   * Test IMDb API key (using OMDb API as proxy)
   */
  private async testIMDbKey(apiKey: string): Promise<ApiKeyValidationResult> {
    const response = await fetch(
      `https://www.omdbapi.com/?t=test&apikey=${apiKey}`
    );

    if (!response.ok) {
      return { valid: false, error: `IMDb API error: ${response.status}` };
    }

    const data = await response.json();

    if (data.Error && data.Error.includes('Invalid API key')) {
      return { valid: false, error: 'Invalid IMDb API key' };
    }

    return {
      valid: true,
      serviceInfo: {
        name: 'IMDb (via OMDb)',
        features: ['Movies', 'TV Shows', 'Ratings', 'Plot Summaries'],
      },
    };
  }
}

// Export singleton instance
export const apiKeyService = new ApiKeyService();
