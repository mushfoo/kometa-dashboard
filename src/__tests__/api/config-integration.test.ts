import { NextRequest } from 'next/server';
import { GET, PUT } from '../../app/api/config/route';
import { POST } from '../../app/api/config/validate/route';
import { ConfigService } from '../../lib/ConfigService';
import { promises as fs } from 'fs';

// Mock the file system and ConfigService
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
    copyFile: jest.fn(),
  },
}));

jest.mock('../../lib/ConfigService', () => ({
  createConfigService: jest.fn(),
  ConfigService: jest.fn(),
}));

// eslint-disable-next-line no-unused-vars
const mockFs = fs as jest.Mocked<typeof fs>;
const mockConfigService = {
  getConfig: jest.fn(),
  updateConfig: jest.fn(),
  validateConfig: jest.fn(),
  getConfigStatus: jest.fn(),
  createBackup: jest.fn(),
};

const MockConfigService = ConfigService as jest.MockedClass<
  typeof ConfigService
>;

describe('/api/config integration tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockConfigService.mockImplementation(() => mockConfigService as any);
    (
      require('../../lib/ConfigService').createConfigService as jest.Mock
    ).mockReturnValue(mockConfigService);
  });

  describe('GET /api/config', () => {
    it('should return configuration and status', async () => {
      const mockConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      };

      const mockStatus = {
        exists: true,
        size: 1024,
        lastModified: new Date('2023-01-01T12:00:00Z'),
        backupCount: 2,
      };

      mockConfigService.getConfig.mockResolvedValue(mockConfig);
      mockConfigService.getConfigStatus.mockResolvedValue(mockStatus);

      const request = new NextRequest('http://localhost:3000/api/config');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config).toEqual(mockConfig);
      expect(data.status).toEqual(mockStatus);
    });

    it('should return null config when file does not exist', async () => {
      const mockStatus = {
        exists: false,
        backupCount: 0,
      };

      mockConfigService.getConfig.mockResolvedValue(null);
      mockConfigService.getConfigStatus.mockResolvedValue(mockStatus);

      const request = new NextRequest('http://localhost:3000/api/config');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config).toBeNull();
      expect(data.status.exists).toBe(false);
    });

    it('should handle service errors', async () => {
      mockConfigService.getConfig.mockRejectedValue(new Error('Service error'));

      const request = new NextRequest('http://localhost:3000/api/config');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to get configuration');
    });
  });

  describe('PUT /api/config', () => {
    const validConfig = {
      plex: {
        url: 'http://localhost:32400',
        token: 'test-token',
      },
      tmdb: {
        apikey: 'test-key',
      },
    };

    it('should update valid configuration', async () => {
      const mockStatus = {
        exists: true,
        size: 1024,
        lastModified: new Date(),
        backupCount: 3,
      };

      mockConfigService.validateConfig.mockResolvedValue({
        valid: true,
        warnings: ['No libraries configured'],
      });
      mockConfigService.updateConfig.mockResolvedValue(undefined);
      mockConfigService.getConfigStatus.mockResolvedValue(mockStatus);

      const request = new NextRequest('http://localhost:3000/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Configuration updated successfully');
      expect(data.warnings).toEqual(['No libraries configured']);
      expect(data.status).toEqual(mockStatus);

      expect(mockConfigService.validateConfig).toHaveBeenCalledWith(
        validConfig
      );
      expect(mockConfigService.updateConfig).toHaveBeenCalledWith(validConfig);
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        plex: {
          url: 'not-a-url',
          token: '',
        },
      };

      mockConfigService.validateConfig.mockResolvedValue({
        valid: false,
        errors: [
          'plex.url: Invalid url',
          'plex.token: String must contain at least 1 character(s)',
        ],
      });

      const request = new NextRequest('http://localhost:3000/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidConfig),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Configuration validation failed');
      expect(data.details.errors).toHaveLength(2);

      expect(mockConfigService.validateConfig).toHaveBeenCalledWith(
        invalidConfig
      );
      expect(mockConfigService.updateConfig).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');
    });

    it('should handle service errors during update', async () => {
      mockConfigService.validateConfig.mockResolvedValue({ valid: true });
      mockConfigService.updateConfig.mockRejectedValue(new Error('Disk full'));

      const request = new NextRequest('http://localhost:3000/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to update configuration');
    });
  });

  describe('POST /api/config/validate', () => {
    it('should validate correct configuration', async () => {
      const validConfig = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      };

      mockConfigService.validateConfig.mockResolvedValue({
        valid: true,
        warnings: ['No metadata provider (TMDb or Trakt) configured'],
      });

      const request = new NextRequest(
        'http://localhost:3000/api/config/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validConfig),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.errors).toEqual([]);
      expect(data.warnings).toEqual([
        'No metadata provider (TMDb or Trakt) configured',
      ]);
      expect(data.summary).toEqual({
        hasErrors: false,
        hasWarnings: true,
        errorCount: 0,
        warningCount: 1,
      });
    });

    it('should return validation errors for invalid configuration', async () => {
      const invalidConfig = {
        plex: {
          url: 'not-a-url',
          token: '',
        },
      };

      mockConfigService.validateConfig.mockResolvedValue({
        valid: false,
        errors: [
          'plex.url: Invalid url',
          'plex.token: String must contain at least 1 character(s)',
        ],
      });

      const request = new NextRequest(
        'http://localhost:3000/api/config/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidConfig),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200); // Validation endpoint returns 200 even for invalid configs
      expect(data.valid).toBe(false);
      expect(data.errors).toHaveLength(2);
      expect(data.summary.hasErrors).toBe(true);
      expect(data.summary.errorCount).toBe(2);
    });

    it('should handle empty configuration', async () => {
      mockConfigService.validateConfig.mockResolvedValue({
        valid: false,
        errors: ['Plex configuration is required'],
      });

      const request = new NextRequest(
        'http://localhost:3000/api/config/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(false);
      expect(data.errors).toContain('Plex configuration is required');
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/config/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json',
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');
    });

    it('should handle service errors during validation', async () => {
      mockConfigService.validateConfig.mockRejectedValue(
        new Error('Service error')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/config/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plex: { url: 'http://test', token: 'token' },
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to validate configuration');
    });
  });
});
