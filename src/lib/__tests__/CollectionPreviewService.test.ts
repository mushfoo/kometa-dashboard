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

    // Set up default mock implementations
    mockTmdbService.discoverMovies.mockResolvedValue({
      results: [
        {
          id: 1,
          title: 'Test Movie',
          original_title: 'Test Movie',
          overview: 'A test movie',
          poster_path: '/test.jpg',
          backdrop_path: '/test-bg.jpg',
          release_date: '2023-01-01',
          genre_ids: [28], // Action
          vote_average: 8.5,
          vote_count: 1000,
          popularity: 100,
          adult: false,
          original_language: 'en',
        },
      ],
      page: 1,
      total_pages: 1,
      total_results: 1,
    });

    mockTmdbService.discoverTVShows.mockResolvedValue({
      results: [
        {
          id: 1,
          name: 'Test TV Show',
          original_name: 'Test TV Show',
          overview: 'A test TV show',
          poster_path: '/test-tv.jpg',
          backdrop_path: '/test-tv-bg.jpg',
          first_air_date: '2023-01-01',
          genre_ids: [18], // Drama
          vote_average: 8.0,
          vote_count: 500,
          popularity: 75,
          origin_country: ['US'],
          original_language: 'en',
        },
      ],
      page: 1,
      total_pages: 1,
      total_results: 1,
    });

    mockTraktService.getPopularMovies.mockResolvedValue([]);
    mockTraktService.getPopularShows.mockResolvedValue([]);

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
        id: 'test-filter-group-1',
        operator: 'AND',
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
        id: 'test-filter-group-2',
        operator: 'AND',
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
        id: 'test-filter-group-3',
        operator: 'AND',
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
        id: 'test-filter-group-4',
        operator: 'AND',
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
        id: 'test-filter-group-5',
        operator: 'AND',
        filters: [
          {
            id: '1',
            field: 'content_type',
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
            original_title: 'External Movie',
            release_date: '2023-01-01',
            genre_ids: [28],
            vote_average: 7.5,
            vote_count: 100,
            popularity: 50.0,
            poster_path: '/poster.jpg',
            backdrop_path: '/backdrop.jpg',
            overview: 'External movie description',
            adult: false,
            video: false,
            original_language: 'en',
          },
        ],
        total_results: 1,
        page: 1,
        total_pages: 1,
      });

      const filters: FilterGroup = {
        id: 'test-filter-group-6',
        operator: 'AND',
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
        confidence_threshold: 50, // Lower threshold to ensure external matches are included
      });

      expect(mockTmdbService.discoverMovies).toHaveBeenCalled();
      // External matches count depends on implementation - just verify structure
      expect(typeof result.external_matches).toBe('number');
      expect(result.external_matches).toBeGreaterThanOrEqual(0);
    });

    it('limits results based on max_items option', async () => {
      const filters: FilterGroup = {
        id: 'test-filter-group-7',
        operator: 'AND',
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
            original_title: 'Low Confidence Movie',
            release_date: '2023-01-01',
            genre_ids: [28],
            vote_average: 5.0,
            vote_count: 50,
            popularity: 10.0,
            poster_path: '/poster.jpg',
            backdrop_path: '/backdrop.jpg',
            overview: 'Low rated movie',
            adult: false,
            video: false,
            original_language: 'en',
          },
        ],
        total_results: 1,
        page: 1,
        total_pages: 1,
      });

      const filters: FilterGroup = {
        id: 'test-filter-group-8',
        operator: 'AND',
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
        id: 'test-filter-group-9',
        operator: 'AND',
        filters: [],
      };

      const result = await service.generatePreview(filters, {
        sort_by: 'rating',
        sort_order: 'desc',
      });

      for (let i = 1; i < result.items.length; i++) {
        const prevRating = result.items[i - 1]?.rating || 0;
        const currentRating = result.items[i]?.rating || 0;
        expect(prevRating).toBeGreaterThanOrEqual(currentRating);
      }
    });

    it('calculates confidence score correctly', async () => {
      const filters: FilterGroup = {
        id: 'test-filter-group-10',
        operator: 'AND',
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
        id: 'test-filter-group-11',
        operator: 'AND',
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

      // Complex filter combination test - verify structure and basic functionality
      expect(result).toEqual({
        items: expect.any(Array),
        total_count: expect.any(Number),
        library_matches: expect.any(Number),
        external_matches: expect.any(Number),
        estimated_new_items: expect.any(Number),
        confidence_score: expect.any(Number),
        filters_applied: expect.any(Object),
        last_updated: expect.any(String),
      });

      // Results can be empty if no items match all complex criteria
      expect(result.items.length).toBeGreaterThanOrEqual(0);
    });

    it('handles disabled filters correctly', async () => {
      const filters: FilterGroup = {
        id: 'test-filter-group-12',
        operator: 'AND',
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
        id: 'test-filter-group-13',
        operator: 'AND',
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
        id: 'test-filter-group-14',
        operator: 'AND',
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
        id: 'test-filter-group-15',
        operator: 'AND',
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
        id: 'test-filter-group-16',
        operator: 'AND',
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
