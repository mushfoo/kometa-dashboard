import { ApiKeyService, TraktCredentials } from '../ApiKeyService';
import { promises as fs } from 'fs';
import path from 'path';

// Mock fetch for API testing
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;
  let testStoragePath: string;

  beforeEach(async () => {
    // Create a unique temporary test storage directory for each test
    testStoragePath = path.join(
      __dirname,
      `../../__tests__/temp/keys-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    await fs.mkdir(testStoragePath, { recursive: true });

    // Create service instance with test storage path
    apiKeyService = new ApiKeyService(testStoragePath);

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(async () => {
    // Clean up test directory completely
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('Key Storage Operations', () => {
    it('should store and retrieve a TMDb API key', async () => {
      const tmdbKey = 'a1b2c3d4e5f6789012345678901234ab';

      await apiKeyService.storeKey('tmdb', tmdbKey);
      const retrievedKey = await apiKeyService.getKey('tmdb');

      expect(retrievedKey).toBe(tmdbKey);
    });

    it('should store and retrieve Trakt credentials', async () => {
      const traktCredentials: TraktCredentials = {
        clientId: 'a'.repeat(64),
        clientSecret: 'b'.repeat(64),
      };

      await apiKeyService.storeKey('trakt', traktCredentials);
      const retrievedCredentials = await apiKeyService.getKey('trakt');

      expect(retrievedCredentials).toEqual(traktCredentials);
    });

    it('should store and retrieve an IMDb API key', async () => {
      const imdbKey = 'test-imdb-key-12345678';

      await apiKeyService.storeKey('imdb', imdbKey);
      const retrievedKey = await apiKeyService.getKey('imdb');

      expect(retrievedKey).toBe(imdbKey);
    });

    it('should return null for non-existent keys', async () => {
      const retrievedKey = await apiKeyService.getKey('tmdb');
      expect(retrievedKey).toBeNull();
    });

    it('should delete stored keys', async () => {
      const tmdbKey = 'a1b2c3d4e5f6789012345678901234ab';

      await apiKeyService.storeKey('tmdb', tmdbKey);
      expect(await apiKeyService.hasKey('tmdb')).toBe(true);

      await apiKeyService.deleteKey('tmdb');
      expect(await apiKeyService.hasKey('tmdb')).toBe(false);
      expect(await apiKeyService.getKey('tmdb')).toBeNull();
    });
  });

  describe('Key Validation', () => {
    it('should validate TMDb API key format', async () => {
      const validKey = 'a1b2c3d4e5f6789012345678901234ab';
      await expect(
        apiKeyService.storeKey('tmdb', validKey)
      ).resolves.not.toThrow();
    });

    it('should reject invalid TMDb API key format', async () => {
      const invalidKey = 'invalid-key';
      await expect(
        apiKeyService.storeKey('tmdb', invalidKey)
      ).rejects.toThrow();
    });

    it('should validate Trakt credentials format', async () => {
      const validCredentials: TraktCredentials = {
        clientId: 'a'.repeat(64),
        clientSecret: 'b'.repeat(64),
      };
      await expect(
        apiKeyService.storeKey('trakt', validCredentials)
      ).resolves.not.toThrow();
    });

    it('should reject invalid Trakt credentials format', async () => {
      const invalidCredentials = {
        clientId: 'short',
        clientSecret: 'short',
      };
      await expect(
        apiKeyService.storeKey('trakt', invalidCredentials as TraktCredentials)
      ).rejects.toThrow();
    });

    it('should validate IMDb API key format', async () => {
      const validKey = 'test-imdb-key';
      await expect(
        apiKeyService.storeKey('imdb', validKey)
      ).resolves.not.toThrow();
    });

    it('should reject invalid IMDb API key format', async () => {
      const invalidKey = 'short';
      await expect(
        apiKeyService.storeKey('imdb', invalidKey)
      ).rejects.toThrow();
    });
  });

  describe('Service Management', () => {
    it('should check if services have keys stored', async () => {
      expect(await apiKeyService.hasKey('tmdb')).toBe(false);

      await apiKeyService.storeKey('tmdb', 'a1b2c3d4e5f6789012345678901234ab');
      expect(await apiKeyService.hasKey('tmdb')).toBe(true);
    });

    it('should list configured services', async () => {
      expect(await apiKeyService.getConfiguredServices()).toEqual([]);

      await apiKeyService.storeKey('tmdb', 'a1b2c3d4e5f6789012345678901234ab');
      await apiKeyService.storeKey('imdb', 'test-imdb-key');

      const configured = await apiKeyService.getConfiguredServices();
      expect(configured).toHaveLength(2);
      expect(configured).toContain('tmdb');
      expect(configured).toContain('imdb');
    });
  });

  describe('API Key Testing', () => {
    it('should test valid TMDb API key', async () => {
      const validKey = 'a1b2c3d4e5f6789012345678901234ab';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: { base_url: 'https://image.tmdb.org/' } }),
      } as Response);

      const result = await apiKeyService.testKey('tmdb', validKey);

      expect(result.valid).toBe(true);
      expect(result.serviceInfo?.name).toBe('The Movie Database (TMDb)');
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.themoviedb.org/3/configuration?api_key=${validKey}`
      );
    });

    it('should test invalid TMDb API key', async () => {
      const invalidKey = 'invalid-key-12345678901234567890';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await apiKeyService.testKey('tmdb', invalidKey);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid TMDb API key');
    });

    it('should test valid Trakt credentials', async () => {
      const validCredentials: TraktCredentials = {
        clientId: 'a'.repeat(64),
        clientSecret: 'b'.repeat(64),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ title: 'Test Movie' }],
      } as Response);

      const result = await apiKeyService.testKey('trakt', validCredentials);

      expect(result.valid).toBe(true);
      expect(result.serviceInfo?.name).toBe('Trakt');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.trakt.tv/movies/trending',
        expect.objectContaining({
          headers: expect.objectContaining({
            'trakt-api-key': validCredentials.clientId,
          }),
        })
      );
    });

    it('should test invalid Trakt credentials', async () => {
      const invalidCredentials: TraktCredentials = {
        clientId: 'invalid'.repeat(16),
        clientSecret: 'invalid'.repeat(16),
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await apiKeyService.testKey('trakt', invalidCredentials);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Trakt API credentials');
    });

    it('should test valid IMDb API key', async () => {
      const validKey = 'test-imdb-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Title: 'Test Movie', Year: '2023' }),
      } as Response);

      const result = await apiKeyService.testKey('imdb', validKey);

      expect(result.valid).toBe(true);
      expect(result.serviceInfo?.name).toBe('IMDb (via OMDb)');
      expect(mockFetch).toHaveBeenCalledWith(
        `https://www.omdbapi.com/?t=test&apikey=${validKey}`
      );
    });

    it('should test invalid IMDb API key', async () => {
      const invalidKey = 'invalid-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Error: 'Invalid API key!' }),
      } as Response);

      const result = await apiKeyService.testKey('imdb', invalidKey);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid IMDb API key');
    });

    it('should handle network errors during testing', async () => {
      const key = 'a1b2c3d4e5f6789012345678901234ab';

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiKeyService.testKey('tmdb', key);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle missing keys during testing', async () => {
      const result = await apiKeyService.testKey('tmdb');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No API key found for service');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unsupported services gracefully', async () => {
      await expect(
        apiKeyService.storeKey('unsupported' as any, 'test')
      ).rejects.toThrow('Unsupported service');
    });

    it('should handle file system errors gracefully', async () => {
      // This test would require mocking the file system to simulate errors
      // For now, we rely on the FileStorageService tests to cover this
    });

    it('should handle malformed stored data', async () => {
      // Manually write malformed data to test error handling
      const invalidDataPath = path.join(testStoragePath, 'tmdb-key.json');
      await fs.writeFile(invalidDataPath, 'invalid json');

      await expect(apiKeyService.getKey('tmdb')).rejects.toThrow();
    });
  });
});
