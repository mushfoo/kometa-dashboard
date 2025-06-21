/**
 * Collection Preview Service
 * Combines external API data (TMDb, Trakt) with local Plex library content
 * to provide real-time preview of what items will be in a collection
 */

import { tmdbService } from './TMDbService';
// import { traktService } from './TraktService';
import { FilterGroup, serializeFilterGroupToKometa } from '@/types/filters';

export interface PreviewItem {
  id: string;
  title: string;
  year?: number;
  type: 'movie' | 'show' | 'season' | 'episode';
  poster_url?: string;
  rating?: number;
  overview?: string;
  genres?: string[];
  match_confidence: number; // 0-100 percentage
  source: 'plex' | 'tmdb' | 'trakt';
  external_ids?: {
    tmdb?: number;
    imdb?: string;
    trakt?: number;
  };
  in_library: boolean;
  file_path?: string;
  plex_id?: string;
}

export interface PreviewResult {
  items: PreviewItem[];
  total_count: number;
  library_matches: number;
  external_matches: number;
  estimated_new_items: number;
  confidence_score: number; // Average match confidence
  filters_applied: Record<string, unknown>;
  last_updated: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  year?: number;
  type: 'movie' | 'show' | 'season' | 'episode';
  genres?: string[];
  rating?: number;
  file_path: string;
  tmdb_id?: number;
  imdb_id?: string;
  added_at: string;
  updated_at: string;
}

export interface PreviewOptions {
  max_items?: number;
  include_external?: boolean;
  confidence_threshold?: number; // Minimum confidence to include
  sort_by?: 'confidence' | 'rating' | 'popularity' | 'title' | 'year';
  sort_order?: 'asc' | 'desc';
}

export class CollectionPreviewService {
  private libraryCache: Map<string, LibraryItem[]> = new Map();
  private genreCache: Map<string, string[]> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor() {
    // Initialize with mock data for MVP
    this.initializeMockLibrary();
  }

  /**
   * Initialize mock library data for development/testing
   */
  private initializeMockLibrary(): void {
    const mockMovies: LibraryItem[] = [
      {
        id: 'plex-1',
        title: 'Inception',
        year: 2010,
        type: 'movie',
        genres: ['Action', 'Sci-Fi', 'Thriller'],
        rating: 8.8,
        file_path: '/movies/Inception (2010)/Inception.mkv',
        tmdb_id: 27205,
        imdb_id: 'tt1375666',
        added_at: '2023-01-15T10:30:00Z',
        updated_at: '2023-01-15T10:30:00Z',
      },
      {
        id: 'plex-2',
        title: 'The Dark Knight',
        year: 2008,
        type: 'movie',
        genres: ['Action', 'Crime', 'Drama'],
        rating: 9.0,
        file_path: '/movies/The Dark Knight (2008)/The Dark Knight.mkv',
        tmdb_id: 155,
        imdb_id: 'tt0468569',
        added_at: '2023-01-10T14:20:00Z',
        updated_at: '2023-01-10T14:20:00Z',
      },
      {
        id: 'plex-3',
        title: 'Interstellar',
        year: 2014,
        type: 'movie',
        genres: ['Adventure', 'Drama', 'Sci-Fi'],
        rating: 8.6,
        file_path: '/movies/Interstellar (2014)/Interstellar.mkv',
        tmdb_id: 157336,
        imdb_id: 'tt0816692',
        added_at: '2023-02-01T09:45:00Z',
        updated_at: '2023-02-01T09:45:00Z',
      },
      {
        id: 'plex-4',
        title: 'Breaking Bad',
        year: 2008,
        type: 'show',
        genres: ['Crime', 'Drama', 'Thriller'],
        rating: 9.5,
        file_path: '/tv/Breaking Bad (2008)',
        tmdb_id: 1396,
        imdb_id: 'tt0903747',
        added_at: '2023-01-05T16:00:00Z',
        updated_at: '2023-03-15T12:30:00Z',
      },
      {
        id: 'plex-5',
        title: 'Stranger Things',
        year: 2016,
        type: 'show',
        genres: ['Drama', 'Fantasy', 'Horror'],
        rating: 8.7,
        file_path: '/tv/Stranger Things (2016)',
        tmdb_id: 66732,
        imdb_id: 'tt4574334',
        added_at: '2023-02-10T11:15:00Z',
        updated_at: '2023-06-01T08:45:00Z',
      },
    ];

    this.libraryCache.set('all', mockMovies);
    this.lastCacheUpdate = Date.now();
  }

  /**
   * Get library items (in real implementation, this would query Plex)
   */
  private async getLibraryItems(): Promise<LibraryItem[]> {
    // Check cache
    if (
      this.libraryCache.has('all') &&
      Date.now() - this.lastCacheUpdate < this.cacheExpiry
    ) {
      return this.libraryCache.get('all')!;
    }

    // In real implementation, this would call Plex API
    // For now, return mock data
    const items = this.libraryCache.get('all') || [];
    this.lastCacheUpdate = Date.now();
    return items;
  }

  /**
   * Match library items against filters
   */
  private matchLibraryItems(
    items: LibraryItem[],
    filters: FilterGroup
  ): PreviewItem[] {
    const kometaFilters = serializeFilterGroupToKometa(filters);

    return items
      .filter((item) => this.itemMatchesFilters(item, kometaFilters))
      .map(
        (item) =>
          ({
            id: item.id,
            title: item.title,
            year: item.year,
            type: item.type,
            rating: item.rating,
            genres: item.genres,
            match_confidence: 95, // High confidence for library matches
            source: 'plex' as const,
            external_ids: {
              tmdb: item.tmdb_id,
              imdb: item.imdb_id,
            },
            in_library: true,
            file_path: item.file_path,
            plex_id: item.id,
          }) as PreviewItem
      );
  }

  /**
   * Check if library item matches Kometa filters
   */
  private itemMatchesFilters(
    item: LibraryItem,
    filters: Record<string, unknown>
  ): boolean {
    // Simple filter matching logic (in real implementation, this would be more sophisticated)

    // Genre filter
    if (filters.genre && Array.isArray(filters.genre)) {
      const hasGenre = (filters.genre as string[]).some((genre) =>
        item.genres?.some((itemGenre) =>
          itemGenre.toLowerCase().includes(genre.toLowerCase())
        )
      );
      if (!hasGenre) return false;
    }

    // Year filter
    if (filters.year) {
      if (typeof filters.year === 'number') {
        if (item.year !== filters.year) return false;
      } else if (typeof filters.year === 'object' && filters.year !== null) {
        const yearFilter = filters.year as { gte?: number; lte?: number };
        if (yearFilter.gte && item.year && item.year < yearFilter.gte)
          return false;
        if (yearFilter.lte && item.year && item.year > yearFilter.lte)
          return false;
      }
    }

    // Rating filter
    if (filters.rating) {
      if (typeof filters.rating === 'number') {
        if (!item.rating || item.rating < filters.rating) return false;
      } else if (
        typeof filters.rating === 'object' &&
        filters.rating !== null
      ) {
        const ratingFilter = filters.rating as { gte?: number; lte?: number };
        if (
          ratingFilter.gte &&
          (!item.rating || item.rating < ratingFilter.gte)
        )
          return false;
        if (
          ratingFilter.lte &&
          (!item.rating || item.rating > ratingFilter.lte)
        )
          return false;
      }
    }

    // Content type filter
    if (filters.type && filters.type !== item.type) {
      return false;
    }

    return true;
  }

  /**
   * Get external matches from TMDb
   */
  private async getExternalMatches(
    filters: FilterGroup,
    options: PreviewOptions
  ): Promise<PreviewItem[]> {
    if (!options.include_external) return [];

    try {
      const kometaFilters = serializeFilterGroupToKometa(filters);
      const externalItems: PreviewItem[] = [];

      // Search TMDb based on filters
      if (kometaFilters.genre && Array.isArray(kometaFilters.genre)) {
        // Get popular movies/shows for specified genres
        const genreQuery = (kometaFilters.genre as string[]).join(',');

        try {
          const tmdbMovies = await tmdbService.discoverMovies({
            with_genres: genreQuery,
            sort_by: 'popularity.desc',
            page: 1,
          });

          externalItems.push(
            ...tmdbMovies.results.slice(0, 10).map(
              (movie) =>
                ({
                  id: `tmdb-movie-${movie.id}`,
                  title: movie.title,
                  year: movie.release_date
                    ? new Date(movie.release_date).getFullYear()
                    : undefined,
                  type: 'movie' as const,
                  poster_url: movie.poster_path || undefined,
                  rating: movie.vote_average,
                  overview: movie.overview,
                  match_confidence: 75, // Medium confidence for external matches
                  source: 'tmdb' as const,
                  external_ids: {
                    tmdb: movie.id,
                  },
                  in_library: false,
                }) as PreviewItem
            )
          );
        } catch (error) {
          console.warn('TMDb API error:', error);
        }
      }

      // Filter by confidence threshold
      return externalItems.filter(
        (item) => item.match_confidence >= (options.confidence_threshold || 50)
      );
    } catch (error) {
      console.error('Error getting external matches:', error);
      return [];
    }
  }

  /**
   * Calculate match confidence between external item and library
   */
  private calculateMatchConfidence(
    external: PreviewItem,
    libraryItems: LibraryItem[]
  ): number {
    // Check for exact matches
    const exactMatch = libraryItems.find((item) => {
      if (
        external.external_ids?.tmdb &&
        item.tmdb_id === external.external_ids.tmdb
      ) {
        return true;
      }
      if (
        external.external_ids?.imdb &&
        item.imdb_id === external.external_ids.imdb
      ) {
        return true;
      }
      // Title and year match
      return (
        item.title.toLowerCase() === external.title.toLowerCase() &&
        item.year === external.year
      );
    });

    if (exactMatch) return 95;

    // Partial title match
    const titleMatch = libraryItems.find(
      (item) =>
        item.title.toLowerCase().includes(external.title.toLowerCase()) ||
        external.title.toLowerCase().includes(item.title.toLowerCase())
    );

    if (titleMatch) return 60;

    return 25; // Low confidence for no matches
  }

  /**
   * Generate collection preview
   */
  public async generatePreview(
    filters: FilterGroup,
    options: PreviewOptions = {}
  ): Promise<PreviewResult> {
    const _startTime = Date.now();

    // Set defaults
    const opts: Required<PreviewOptions> = {
      max_items: options.max_items || 50,
      include_external: options.include_external ?? true,
      confidence_threshold: options.confidence_threshold || 50,
      sort_by: options.sort_by || 'confidence',
      sort_order: options.sort_order || 'desc',
    };

    // Get library items
    const libraryItems = await this.getLibraryItems();

    // Match library items against filters
    const libraryMatches = this.matchLibraryItems(libraryItems, filters);

    // Get external matches
    const externalMatches = await this.getExternalMatches(filters, opts);

    // Update external match confidence based on library
    externalMatches.forEach((external) => {
      external.match_confidence = this.calculateMatchConfidence(
        external,
        libraryItems
      );
    });

    // Combine and deduplicate
    const allItems = [...libraryMatches, ...externalMatches];
    const uniqueItems = this.deduplicateItems(allItems);

    // Apply confidence threshold
    const filteredItems = uniqueItems.filter(
      (item) => item.match_confidence >= opts.confidence_threshold
    );

    // Sort items
    const sortedItems = this.sortItems(
      filteredItems,
      opts.sort_by,
      opts.sort_order
    );

    // Limit results
    const limitedItems = sortedItems.slice(0, opts.max_items);

    // Calculate statistics
    const libraryMatchCount = limitedItems.filter(
      (item) => item.in_library
    ).length;
    const externalMatchCount = limitedItems.filter(
      (item) => !item.in_library
    ).length;
    const avgConfidence =
      limitedItems.length > 0
        ? limitedItems.reduce((sum, item) => sum + item.match_confidence, 0) /
          limitedItems.length
        : 0;

    return {
      items: limitedItems,
      total_count: sortedItems.length,
      library_matches: libraryMatchCount,
      external_matches: externalMatchCount,
      estimated_new_items: externalMatchCount,
      confidence_score: Math.round(avgConfidence),
      filters_applied: serializeFilterGroupToKometa(filters),
      last_updated: new Date().toISOString(),
    };
  }

  /**
   * Remove duplicate items
   */
  private deduplicateItems(items: PreviewItem[]): PreviewItem[] {
    const seen = new Set<string>();
    const unique: PreviewItem[] = [];

    for (const item of items) {
      // Create unique key based on external IDs or title+year
      const key = item.external_ids?.tmdb
        ? `tmdb-${item.external_ids.tmdb}`
        : item.external_ids?.imdb
          ? `imdb-${item.external_ids.imdb}`
          : `${item.title.toLowerCase()}-${item.year || 'unknown'}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      } else {
        // If we have both library and external versions, prefer library
        const existingIndex = unique.findIndex((existing) => {
          const existingKey = existing.external_ids?.tmdb
            ? `tmdb-${existing.external_ids.tmdb}`
            : existing.external_ids?.imdb
              ? `imdb-${existing.external_ids.imdb}`
              : `${existing.title.toLowerCase()}-${existing.year || 'unknown'}`;
          return existingKey === key;
        });

        if (
          existingIndex >= 0 &&
          item.in_library &&
          !unique[existingIndex]?.in_library
        ) {
          unique[existingIndex] = item;
        }
      }
    }

    return unique;
  }

  /**
   * Sort items based on criteria
   */
  private sortItems(
    items: PreviewItem[],
    sortBy: PreviewOptions['sort_by'],
    sortOrder: PreviewOptions['sort_order']
  ): PreviewItem[] {
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    return items.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return (a.match_confidence - b.match_confidence) * multiplier;
        case 'rating':
          return ((a.rating || 0) - (b.rating || 0)) * multiplier;
        case 'title':
          return a.title.localeCompare(b.title) * multiplier;
        case 'year':
          return ((a.year || 0) - (b.year || 0)) * multiplier;
        case 'popularity':
          // In library items get priority, then by rating
          if (a.in_library !== b.in_library) {
            return a.in_library ? -1 : 1;
          }
          return ((a.rating || 0) - (b.rating || 0)) * multiplier;
        default:
          return 0;
      }
    });
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.libraryCache.clear();
    this.genreCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Get preview statistics without full preview
   */
  public async getPreviewStats(filters: FilterGroup): Promise<{
    estimated_count: number;
    library_matches: number;
    confidence: number;
  }> {
    const libraryItems = await this.getLibraryItems();
    const matches = this.matchLibraryItems(libraryItems, filters);

    return {
      estimated_count: matches.length + 5, // Add some buffer for external matches
      library_matches: matches.length,
      confidence: matches.length > 0 ? 85 : 50,
    };
  }
}

// Export singleton instance
export const collectionPreviewService = new CollectionPreviewService();
