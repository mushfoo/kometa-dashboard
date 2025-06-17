import { GET, PUT } from '@/app/api/config/route';
import { POST } from '@/app/api/config/validate/route';
import { NextRequest } from 'next/server';
import * as yaml from 'js-yaml';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

// Helper to create NextRequest with proper setup
function createRequest(url: string, options?: RequestInit) {
  return new Request(url, options);
}

describe.skip('Configuration API Endpoints', () => {
  let testDir: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Create temp directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-api-test-'));
    await fs.mkdir(path.join(testDir, 'storage'), { recursive: true });

    // Set environment variable for testing
    originalEnv = process.env.STORAGE_PATH;
    process.env.STORAGE_PATH = path.join(testDir, 'storage');
  });

  afterEach(async () => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.STORAGE_PATH = originalEnv;
    } else {
      delete process.env.STORAGE_PATH;
    }

    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('GET /api/config', () => {
    it('should return null config when file does not exist', async () => {
      const request = createRequest('http://localhost:3000/api/config');
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config).toBeNull();
      expect(data.status.exists).toBe(false);
    });

    it('should return configuration when file exists', async () => {
      const config = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      };

      // Write config file
      const configPath = path.join(testDir, 'storage', 'config.yml');
      await fs.writeFile(configPath, yaml.dump(config));

      const request = createRequest('http://localhost:3000/api/config');
      const response = await GET(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config).toEqual(config);
      expect(data.status.exists).toBe(true);
    });
  });

  describe('PUT /api/config', () => {
    it('should update valid configuration', async () => {
      const config = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      };

      const request = createRequest('http://localhost:3000/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const response = await PUT(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Configuration updated successfully');

      // Verify file was written
      const configPath = path.join(testDir, 'storage', 'config.yml');
      const writtenContent = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.load(writtenContent);
      expect(parsedConfig).toEqual(config);
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        plex: {
          url: 'not-a-url',
          token: '',
        },
      };

      const request = createRequest('http://localhost:3000/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidConfig),
      });

      const response = await PUT(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Configuration validation failed');
      expect(data.details.errors).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const request = createRequest('http://localhost:3000/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await PUT(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');
    });
  });

  describe('POST /api/config/validate', () => {
    it('should validate correct configuration', async () => {
      const config = {
        plex: {
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      };

      const request = createRequest(
        'http://localhost:3000/api/config/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        }
      );

      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.errors).toEqual([]);
    });

    it('should return validation errors for invalid configuration', async () => {
      const invalidConfig = {
        plex: {
          url: 'not-a-url',
          token: '',
        },
      };

      const request = createRequest(
        'http://localhost:3000/api/config/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidConfig),
        }
      );

      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200); // Validation endpoint returns 200 even for invalid configs
      expect(data.valid).toBe(false);
      expect(data.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty configuration', async () => {
      const request = createRequest(
        'http://localhost:3000/api/config/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(false);
      const hasPlexError = data.errors.some(
        (e: string) => e.includes('plex') || e.includes('Plex')
      );
      expect(hasPlexError).toBe(true);
    });
  });
});
