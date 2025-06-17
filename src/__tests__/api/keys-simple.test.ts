import { apiKeyService } from '@/lib/ApiKeyService';

// Mock fetch for API testing
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('API Key Management - Unit Tests', () => {
  beforeEach(async () => {
    // Clear any existing keys
    try {
      const services = await apiKeyService.getConfiguredServices();
      await Promise.all(
        services.map((service) => apiKeyService.deleteKey(service))
      );
    } catch {
      // Ignore errors during cleanup
    }

    // Reset fetch mock
    mockFetch.mockReset();
  });

  describe('Core API Key Service Integration', () => {
    it('should store and retrieve API keys', async () => {
      const tmdbKey = 'a1b2c3d4e5f6789012345678901234ab';

      // Test storing
      await apiKeyService.storeKey('tmdb', tmdbKey);
      expect(await apiKeyService.hasKey('tmdb')).toBe(true);

      // Test retrieving
      const retrievedKey = await apiKeyService.getKey('tmdb');
      expect(retrievedKey).toBe(tmdbKey);

      // Test service listing
      const configuredServices = await apiKeyService.getConfiguredServices();
      expect(configuredServices).toContain('tmdb');
    });

    it('should validate API key formats', async () => {
      // Valid TMDb key
      const validTmdbKey = 'a1b2c3d4e5f6789012345678901234ab';
      await expect(
        apiKeyService.storeKey('tmdb', validTmdbKey)
      ).resolves.not.toThrow();

      // Invalid TMDb key
      const invalidTmdbKey = 'invalid-key';
      await expect(
        apiKeyService.storeKey('tmdb', invalidTmdbKey)
      ).rejects.toThrow();
    });

    it('should test API connections', async () => {
      const tmdbKey = 'a1b2c3d4e5f6789012345678901234ab';
      await apiKeyService.storeKey('tmdb', tmdbKey);

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: { base_url: 'https://image.tmdb.org/' } }),
      } as Response);

      const result = await apiKeyService.testKey('tmdb');
      expect(result.valid).toBe(true);
      expect(result.serviceInfo?.name).toBe('The Movie Database (TMDb)');
    });

    it('should handle API connection failures', async () => {
      const tmdbKey = 'a1b2c3d4e5f6789012345678901234ab';
      await apiKeyService.storeKey('tmdb', tmdbKey);

      // Mock failed API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await apiKeyService.testKey('tmdb');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid TMDb API key');
    });

    it('should delete API keys', async () => {
      const tmdbKey = 'a1b2c3d4e5f6789012345678901234ab';

      await apiKeyService.storeKey('tmdb', tmdbKey);
      expect(await apiKeyService.hasKey('tmdb')).toBe(true);

      await apiKeyService.deleteKey('tmdb');
      expect(await apiKeyService.hasKey('tmdb')).toBe(false);
    });

    it('should handle Trakt credentials', async () => {
      const traktCredentials = {
        clientId: 'a'.repeat(64),
        clientSecret: 'b'.repeat(64),
      };

      await apiKeyService.storeKey('trakt', traktCredentials);
      const retrieved = await apiKeyService.getKey('trakt');

      expect(retrieved).toEqual(traktCredentials);
    });

    it('should handle multiple services', async () => {
      const tmdbKey = 'a1b2c3d4e5f6789012345678901234ab';
      const imdbKey = 'test-imdb-key-123';

      await apiKeyService.storeKey('tmdb', tmdbKey);
      await apiKeyService.storeKey('imdb', imdbKey);

      const configuredServices = await apiKeyService.getConfiguredServices();
      expect(configuredServices).toHaveLength(2);
      expect(configuredServices).toContain('tmdb');
      expect(configuredServices).toContain('imdb');
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported services', async () => {
      // @ts-expect-error Testing unsupported service
      await expect(
        apiKeyService.storeKey('unsupported', 'test')
      ).rejects.toThrow('Unsupported service');
    });

    it('should handle missing keys gracefully', async () => {
      const result = await apiKeyService.testKey('tmdb');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No API key found for service');
    });

    it('should handle network errors during testing', async () => {
      const tmdbKey = 'a1b2c3d4e5f6789012345678901234ab';
      await apiKeyService.storeKey('tmdb', tmdbKey);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiKeyService.testKey('tmdb');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Service-Specific Validations', () => {
    it('should validate TMDb key format specifically', async () => {
      // Valid format
      const validKey = 'a1b2c3d4e5f6789012345678901234ab';
      await expect(
        apiKeyService.storeKey('tmdb', validKey)
      ).resolves.not.toThrow();

      // Too short
      await expect(apiKeyService.storeKey('tmdb', 'short')).rejects.toThrow();

      // Invalid characters
      await expect(
        apiKeyService.storeKey('tmdb', 'g1h2i3j4k5l6789012345678901234ab')
      ).rejects.toThrow();
    });

    it('should validate Trakt credentials format', async () => {
      // Valid credentials
      const validCreds = {
        clientId: 'a'.repeat(64),
        clientSecret: 'b'.repeat(64),
      };
      await expect(
        apiKeyService.storeKey('trakt', validCreds)
      ).resolves.not.toThrow();

      // Invalid - too short
      const invalidCreds = {
        clientId: 'short',
        clientSecret: 'short',
      };
      // @ts-expect-error Testing invalid format
      await expect(
        apiKeyService.storeKey('trakt', invalidCreds)
      ).rejects.toThrow();
    });

    it('should validate IMDb key format', async () => {
      // Valid key
      const validKey = 'test-imdb-key-12345678';
      await expect(
        apiKeyService.storeKey('imdb', validKey)
      ).resolves.not.toThrow();

      // Too short
      await expect(apiKeyService.storeKey('imdb', 'short')).rejects.toThrow();
    });
  });
});
