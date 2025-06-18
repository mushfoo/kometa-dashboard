import { GET, POST } from '@/app/api/config/plex/route';
import { ConfigService } from '@/lib/ConfigService';
import { apiHelpers } from '../../utils/testUtils';

// Mock ConfigService
jest.mock('@/lib/ConfigService');
const MockedConfigService = ConfigService as jest.MockedClass<
  typeof ConfigService
>;

describe('/api/config/plex', () => {
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = new MockedConfigService() as jest.Mocked<ConfigService>;
    MockedConfigService.mockImplementation(() => mockConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return empty config when no Plex config exists', async () => {
      mockConfigService.getConfig.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        url: '',
        token: '',
        selectedLibraries: [],
      });
    });

    it('should return existing Plex configuration', async () => {
      const mockConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token-123456789012',
          timeout: 60,
        },
        libraries: {
          Movies: {
            operations: {
              assets_for_all: false,
              delete_collections: false,
              mass_critic_rating_update: false,
              split_duplicates: false,
            },
          },
          'TV Shows': {
            operations: {
              assets_for_all: true,
              delete_collections: false,
              mass_critic_rating_update: false,
              split_duplicates: false,
            },
          },
        },
      };

      mockConfigService.getConfig.mockResolvedValue(mockConfig);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        url: 'http://localhost:32400',
        token: 'test-token-123456789012',
        selectedLibraries: ['Movies', 'TV Shows'],
      });
    });

    it('should handle config service errors', async () => {
      mockConfigService.getConfig.mockRejectedValue(
        new Error('File not found')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to load configuration',
      });
    });
  });

  describe('POST', () => {
    it('should save Plex configuration with selected libraries', async () => {
      const requestData = {
        url: 'http://192.168.1.100:32400',
        token: 'new-token-456789012345',
        selectedLibraries: ['Movies', 'TV Shows'],
      };

      const existingConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'old-token-123456789012',
          timeout: 60,
        },
        libraries: {},
      };

      mockConfigService.getConfig.mockResolvedValue(existingConfig);
      mockConfigService.updateConfig.mockResolvedValue();

      const request = apiHelpers.createMockNextRequest(
        'http://localhost:3000/api/config/plex',
        {
          method: 'POST',
          body: JSON.stringify(requestData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      if (response.status !== 200) {
        console.error('Test failed with response:', data);
      }

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });

      // Verify updateConfig was called with correct structure
      expect(mockConfigService.updateConfig).toHaveBeenCalledWith({
        plex: {
          url: 'http://192.168.1.100:32400',
          token: 'new-token-456789012345',
          timeout: 60,
        },
        libraries: {
          Movies: {
            operations: {
              assets_for_all: false,
              delete_collections: false,
              mass_critic_rating_update: false,
              split_duplicates: false,
            },
          },
          'TV Shows': {
            operations: {
              assets_for_all: false,
              delete_collections: false,
              mass_critic_rating_update: false,
              split_duplicates: false,
            },
          },
        },
      });
    });

    it('should preserve existing library configurations', async () => {
      const requestData = {
        url: 'http://192.168.1.100:32400',
        token: 'token-123456789012345',
        selectedLibraries: ['Movies', 'TV Shows'],
      };

      const existingConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'old-token-123456789012',
          timeout: 60,
        },
        libraries: {
          Movies: {
            operations: {
              assets_for_all: true,
              delete_collections: true,
              mass_critic_rating_update: false,
              split_duplicates: false,
            },
            custom_setting: 'preserved',
          },
        },
      };

      mockConfigService.getConfig.mockResolvedValue(existingConfig);
      mockConfigService.updateConfig.mockResolvedValue();

      const request = apiHelpers.createMockNextRequest(
        'http://localhost:3000/api/config/plex',
        {
          method: 'POST',
          body: JSON.stringify(requestData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);

      // Verify existing configuration is preserved
      const updateCall = mockConfigService.updateConfig.mock.calls[0]?.[0];
      expect(updateCall?.libraries?.['Movies']).toEqual({
        operations: {
          assets_for_all: true,
          delete_collections: true,
          mass_critic_rating_update: false,
          split_duplicates: false,
        },
        custom_setting: 'preserved',
      });
    });

    it('should validate request data', async () => {
      const invalidData = {
        url: 'invalid-url',
        token: '',
      };

      const request = apiHelpers.createMockNextRequest(
        'http://localhost:3000/api/config/plex',
        {
          method: 'POST',
          body: JSON.stringify(invalidData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid configuration');
      expect(data.details).toBeDefined();
    });

    it('should handle missing configuration', async () => {
      mockConfigService.getConfig.mockResolvedValue(null);

      const request = apiHelpers.createMockNextRequest(
        'http://localhost:3000/api/config/plex',
        {
          method: 'POST',
          body: JSON.stringify({
            url: 'http://localhost:32400',
            token: 'token-123456789012345',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Configuration not found');
    });

    it('should handle config service update errors', async () => {
      const requestData = {
        url: 'http://localhost:32400',
        token: 'token-123456789012345',
      };

      mockConfigService.getConfig.mockResolvedValue({
        plex: { url: '', token: '', timeout: 60 },
        libraries: {},
      });
      mockConfigService.updateConfig.mockRejectedValue(
        new Error('Write failed')
      );

      const request = apiHelpers.createMockNextRequest(
        'http://localhost:3000/api/config/plex',
        {
          method: 'POST',
          body: JSON.stringify(requestData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save configuration');
    });
  });
});
