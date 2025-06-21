import { CollectionPreviewService } from '../CollectionPreviewService';
import { FilterGroup } from '@/types/filters';
import { tmdbService } from '../TMDbService';
import { traktService } from '../TraktService';

// Mock the external services
jest.mock('../TMDbService');
jest.mock('../TraktService');

const mockTmdbService = tmdbService as jest.Mocked<typeof tmdbService>;
const mockTraktService = traktService as jest.Mocked<typeof traktService>;

describe('CollectionPreviewService', () => {
  let service: CollectionPreviewService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CollectionPreviewService();
  });

  describe('constructor', () => {
    it('initializes with mock library data', () => {
      expect(service).toBeInstanceOf(CollectionPreviewService);
    });
  });

  describe('generatePreview', () => {
    it('generates preview with empty filters', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [],
      };

      const result = await service.generatePreview(filters);

      expect(result).toEqual({
        items: expect.any(Array),
        total_count: expect.any(Number),
        library_matches: expect.any(Number),
        external_matches: 0,
        estimated_new_items: 0,
        confidence_score: expect.any(Number),
        filters_applied: expect.any(Object),
        last_updated: expect.any(String),
      });
    });

    it('filters library items by genre', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'genre',
            operator: 'contains',
            value: ['Action'],
            enabled: true,
          },
        ],
      };

      const result = await service.generatePreview(filters);

      expect(
        result.items.every((item) =>
          item.genres?.some((genre) => genre.includes('Action'))
        )
      ).toBe(true);
      expect(result.library_matches).toBeGreaterThan(0);
    });

    it('filters library items by year', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'year',
            operator: 'equals',
            value: 2010,
            enabled: true,
          },
        ],
      };

      const result = await service.generatePreview(filters);

      expect(result.items.every((item) => item.year === 2010)).toBe(true);
    });

    it('filters library items by rating range', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'rating',
            operator: 'greater_than',
            value: 8.5,
            enabled: true,
          },
        ],
      };

      const result = await service.generatePreview(filters);

      expect(
        result.items.every((item) => (item.rating ? item.rating > 8.5 : false))
      ).toBe(true);
    });

    it('filters library items by content type', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'type',
            operator: 'equals',
            value: 'movie',
            enabled: true,
          },
        ],
      };

      const result = await service.generatePreview(filters);

      expect(result.items.every((item) => item.type === 'movie')).toBe(true);
    });

    it('includes external data when enabled', async () => {
      mockTmdbService.discoverMovies.mockResolvedValue({
        results: [
          {
            id: 12345,
            title: 'External Movie',
            release_date: '2023-01-01',
            genre_ids: [28],
            vote_average: 7.5,
            poster_path: '/poster.jpg',
            overview: 'External movie description',
          },
        ],
        total_results: 1,
        page: 1,
        total_pages: 1,
      });

      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'genre',
            operator: 'contains',
            value: ['Action'],
            enabled: true,
          },
        ],
      };

      const result = await service.generatePreview(filters, {
        include_external: true,
        max_items: 50,
      });

      expect(mockTmdbService.discoverMovies).toHaveBeenCalled();
      expect(result.external_matches).toBeGreaterThan(0);
    });

    it('limits results based on max_items option', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [],
      };

      const result = await service.generatePreview(filters, {
        max_items: 2,
      });

      expect(result.items.length).toBeLessThanOrEqual(2);
    });

    it('filters by confidence threshold', async () => {
      mockTmdbService.discoverMovies.mockResolvedValue({
        results: [
          {
            id: 12345,
            title: 'Low Confidence Movie',
            release_date: '2023-01-01',
            genre_ids: [28],
            vote_average: 5.0,
            poster_path: '/poster.jpg',
            overview: 'Low rated movie',
          },
        ],
        total_results: 1,
        page: 1,
        total_pages: 1,
      });

      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'genre',
            operator: 'contains',
            value: ['Action'],
            enabled: true,
          },
        ],
      };

      const result = await service.generatePreview(filters, {
        include_external: true,
        confidence_threshold: 80,
      });

      // Should filter out low confidence external matches
      expect(result.items.every((item) => item.match_confidence >= 80)).toBe(
        true
      );
    });

    it('sorts results by different criteria', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [],
      };

      const result = await service.generatePreview(filters, {
        sort_by: 'rating',
        sort_order: 'desc',
      });

      for (let i = 1; i < result.items.length; i++) {
        const prevRating = result.items[i - 1].rating || 0;
        const currentRating = result.items[i].rating || 0;
        expect(prevRating).toBeGreaterThanOrEqual(currentRating);
      }
    });

    it('calculates confidence score correctly', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'genre',
            operator: 'contains',
            value: ['Action'],
            enabled: true,
          },
        ],
      };

      const result = await service.generatePreview(filters);

      expect(result.confidence_score).toBeGreaterThan(0);
      expect(result.confidence_score).toBeLessThanOrEqual(100);
    });

    it('handles complex filter combinations', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'genre',
            operator: 'contains',
            value: ['Action'],
            enabled: true,
          },
          {
            id: '2',
            field: 'year',
            operator: 'greater_than',
            value: 2008,
            enabled: true,
          },
          {
            id: '3',
            field: 'rating',
            operator: 'greater_than',
            value: 8.0,
            enabled: true,
          },
        ],
      };

      const result = await service.generatePreview(filters);

      expect(
        result.items.every(
          (item) =>
            item.genres?.some((genre) => genre.includes('Action')) &&
            (item.year ? item.year > 2008 : false) &&
            (item.rating ? item.rating > 8.0 : false)
        )
      ).toBe(true);
    });

    it('handles disabled filters correctly', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'genre',
            operator: 'contains',
            value: ['Action'],
            enabled: true,
          },
          {
            id: '2',
            field: 'year',
            operator: 'equals',
            value: 1900, // This would filter out everything if enabled
            enabled: false,
          },
        ],
      };

      const result = await service.generatePreview(filters);

      // Should still have results since the year filter is disabled
      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('handles TMDb service errors gracefully', async () => {
      mockTmdbService.discoverMovies.mockRejectedValue(
        new Error('TMDb API error')
      );

      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'genre',
            operator: 'contains',
            value: ['Action'],
            enabled: true,
          },
        ],
      };

      const result = await service.generatePreview(filters, {
        include_external: true,
      });

      // Should still return library matches even if external service fails
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.external_matches).toBe(0);
    });

    it('handles Trakt service errors gracefully', async () => {
      mockTraktService.getTrendingMovies.mockRejectedValue(
        new Error('Trakt API error')
      );

      const filters: FilterGroup = {
        operator: 'and',
        filters: [
          {
            id: '1',
            field: 'genre',
            operator: 'contains',
            value: ['Action'],
            enabled: true,
          },
        ],
      };

      // This should not throw an error
      await expect(
        service.generatePreview(filters, {
          include_external: true,
        })
      ).resolves.toBeDefined();
    });
  });

  describe('caching', () => {
    it('uses cached library data within expiry time', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [],
      };

      // First call
      const result1 = await service.generatePreview(filters);

      // Second call should use cache
      const result2 = await service.generatePreview(filters);

      expect(result1.library_matches).toBe(result2.library_matches);
    });
  });

  describe('preview item structure', () => {
    it('returns correctly structured preview items', async () => {
      const filters: FilterGroup = {
        operator: 'and',
        filters: [],
      };

      const result = await service.generatePreview(filters);

      result.items.forEach((item) => {
        expect(item).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          type: expect.any(String),
          match_confidence: expect.any(Number),
          source: expect.any(String),
          in_library: expect.any(Boolean),
        });

        expect(item.match_confidence).toBeGreaterThanOrEqual(0);
        expect(item.match_confidence).toBeLessThanOrEqual(100);
        expect(['movie', 'show', 'season', 'episode']).toContain(item.type);
        expect(['plex', 'tmdb', 'trakt']).toContain(item.source);
      });
    });
  });
});
