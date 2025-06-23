// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    copyFile: jest.fn(),
    rename: jest.fn(),
    mkdir: jest.fn(),
  },
}));

import { POST } from '../../app/api/collections/route';
import { promises as fs } from 'fs';
import yaml from 'js-yaml';

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Collections API - Filter Integration', () => {
  const mockConfig = {
    libraries: {
      Movies: {
        collection_files: [],
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.readFile.mockResolvedValue(yaml.dump(mockConfig));
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.copyFile.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);

    // Mock console.log to avoid logging during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  const createRequest = (body: any) => {
    return {
      json: jest.fn().mockResolvedValue(body),
      url: 'http://localhost:3000/api/collections',
      method: 'POST',
      headers: new Map([['Content-Type', 'application/json']]),
    } as any;
  };

  describe('Smart collection YAML generation', () => {
    it('should generate proper Kometa YAML with plex_all builder', async () => {
      const requestBody = {
        name: 'Action Movies',
        description: 'High-rated action movies',
        type: 'smart',
        library: 'Movies',
        filters: {
          genre: 'Action',
          'user_rating.gte': 7.0,
          'year.gte': 2000,
        },
      };

      const request = createRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mockFs.writeFile).toHaveBeenCalled();

      // Get the YAML content that was written
      const writeCall = mockFs.writeFile.mock.calls.find((call) =>
        call[0]?.toString().includes('action-movies.yml')
      );
      expect(writeCall).toBeDefined();

      const yamlContent = writeCall![1] as string;
      const parsedYaml = yaml.load(yamlContent) as any;

      expect(parsedYaml).toEqual({
        collections: {
          'Action Movies': {
            plex_all: true,
            summary: 'High-rated action movies',
            genre: 'Action',
            'user_rating.gte': 7.0,
            'year.gte': 2000,
          },
        },
      });
    });

    it('should handle complex filter combinations', async () => {
      const requestBody = {
        name: 'Premium Sci-Fi',
        type: 'smart',
        library: 'Movies',
        filters: {
          genre: 'Sci-Fi',
          'user_rating.gte': 8.0,
          'year.gte': 2010,
          'year.lte': 2020,
          'director.not': 'Michael Bay',
        },
      };

      const request = createRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(201);

      const writeCall = mockFs.writeFile.mock.calls.find((call) =>
        call[0]?.toString().includes('premium-sci-fi.yml')
      );
      const yamlContent = writeCall![1] as string;
      const parsedYaml = yaml.load(yamlContent) as any;

      expect(parsedYaml.collections['Premium Sci-Fi']).toEqual({
        plex_all: true,
        genre: 'Sci-Fi',
        'user_rating.gte': 8.0,
        'year.gte': 2010,
        'year.lte': 2020,
        'director.not': 'Michael Bay',
      });
    });

    it('should not add plex_all for manual collections', async () => {
      const requestBody = {
        name: 'Manual Collection',
        type: 'manual',
        library: 'Movies',
        description: 'Manually curated movies',
      };

      const request = createRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(201);

      const writeCall = mockFs.writeFile.mock.calls.find((call) =>
        call[0]?.toString().includes('manual-collection.yml')
      );
      const yamlContent = writeCall![1] as string;
      const parsedYaml = yaml.load(yamlContent) as any;

      expect(parsedYaml.collections['Manual Collection']).toEqual({
        summary: 'Manually curated movies',
      });
      expect(
        parsedYaml.collections['Manual Collection'].plex_all
      ).toBeUndefined();
    });

    it('should handle empty filters gracefully', async () => {
      const requestBody = {
        name: 'Empty Filters',
        type: 'smart',
        library: 'Movies',
        filters: {},
      };

      const request = createRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(201);

      const writeCall = mockFs.writeFile.mock.calls.find((call) =>
        call[0]?.toString().includes('empty-filters.yml')
      );
      const yamlContent = writeCall![1] as string;
      const parsedYaml = yaml.load(yamlContent) as any;

      expect(parsedYaml.collections['Empty Filters']).toEqual({
        plex_all: true,
      });
    });
  });

  describe('Field mapping validation', () => {
    it('should correctly map UI field names to Kometa format', async () => {
      const requestBody = {
        name: 'Field Mapping Test',
        type: 'smart',
        library: 'Movies',
        filters: {
          // These should be processed by processFilters function
          rating: { gte: 8.0 },
          date_added: { gte: '2024-01-01' },
          date_released: { lte: '2023-12-31' },
          availability: 'Netflix',
        },
      };

      const request = createRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(201);

      const writeCall = mockFs.writeFile.mock.calls.find((call) =>
        call[0]?.toString().includes('field-mapping-test.yml')
      );
      const yamlContent = writeCall![1] as string;
      const parsedYaml = yaml.load(yamlContent) as any;

      // Verify the processFilters function converts nested objects to dot notation
      expect(parsedYaml.collections['Field Mapping Test']).toEqual({
        plex_all: true,
        'rating.gte': 8.0,
        'date_added.gte': '2024-01-01',
        'date_released.lte': '2023-12-31',
        availability: 'Netflix',
      });
    });
  });

  describe('YAML structure validation', () => {
    it('should generate valid YAML that can be parsed', async () => {
      const requestBody = {
        name: 'YAML Validation',
        type: 'smart',
        library: 'Movies',
        description: 'Test YAML generation',
        poster: 'https://example.com/poster.jpg',
        sort_order: 'critic_rating',
        visible_library: true,
        visible_home: false,
        collection_mode: 'hide_items',
        filters: {
          genre: 'Drama',
          'user_rating.gte': 7.5,
        },
      };

      const request = createRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(201);

      const writeCall = mockFs.writeFile.mock.calls.find((call) =>
        call[0]?.toString().includes('yaml-validation.yml')
      );
      const yamlContent = writeCall![1] as string;

      // Ensure YAML is valid and can be parsed
      expect(() => yaml.load(yamlContent)).not.toThrow();

      const parsedYaml = yaml.load(yamlContent) as any;
      expect(parsedYaml.collections['YAML Validation']).toEqual({
        plex_all: true,
        summary: 'Test YAML generation',
        poster: 'https://example.com/poster.jpg',
        sort_title: 'critic_rating',
        collection_mode: 'hide_items',
        visible_library: true,
        visible_home: false,
        genre: 'Drama',
        'user_rating.gte': 7.5,
      });
    });

    it('should handle special characters in collection names', async () => {
      const requestBody = {
        name: 'Action & Adventure: 2000s+',
        type: 'smart',
        library: 'Movies',
        filters: {
          genre: 'Action',
        },
      };

      const request = createRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(201);

      // Check filename sanitization
      const writeCall = mockFs.writeFile.mock.calls.find((call) =>
        call[0]?.toString().includes('.yml')
      );
      expect(writeCall![0]).toContain('action-adventure-2000s.yml');

      // Check YAML content preserves original name
      const yamlContent = writeCall![1] as string;
      const parsedYaml = yaml.load(yamlContent) as any;
      expect(
        parsedYaml.collections['Action & Adventure: 2000s+']
      ).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle invalid filter data', async () => {
      const requestBody = {
        name: 'Invalid Filters',
        type: 'smart',
        library: 'Movies',
        filters: null,
      };

      const request = createRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
      // Should not crash, just skip filters
    });

    it('should validate required fields', async () => {
      const requestBody = {
        description: 'Missing name',
        type: 'smart',
        library: 'Movies',
      };

      const request = createRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error).toBe('Invalid collection data');
    });

    it('should handle non-existent library', async () => {
      const requestBody = {
        name: 'Test Collection',
        type: 'smart',
        library: 'NonExistentLibrary',
        filters: {},
      };

      const request = createRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error).toBe(
        'Library \"NonExistentLibrary\" not found'
      );
    });
  });
});
