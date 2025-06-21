/**
 * TMDb API Integration Service
 * Provides movie and TV show data retrieval from The Movie Database API
 */

export interface TMDbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  video?: boolean;
  original_language: string;
}

export interface TMDbTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  origin_country: string[];
  original_language: string;
}

export interface TMDbGenre {
  id: number;
  name: string;
}

export interface TMDbSearchResults<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDbMovieDetails extends TMDbMovie {
  budget: number;
  revenue: number;
  runtime: number;
  status: string;
  tagline: string;
  genres: TMDbGenre[];
  production_companies: {
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }[];
  credits?: {
    cast: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
      order: number;
    }[];
    crew: {
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }[];
  };
}

export interface TMDbConfiguration {
  images: {
    base_url: string;
    secure_base_url: string;
    backdrop_sizes: string[];
    logo_sizes: string[];
    poster_sizes: string[];
    profile_sizes: string[];
    still_sizes: string[];
  };
}

export interface TMDbDiscoverOptions {
  sort_by?: string;
  primary_release_date_gte?: string;
  primary_release_date_lte?: string;
  vote_average_gte?: number;
  vote_average_lte?: number;
  with_genres?: string;
  without_genres?: string;
  with_cast?: string;
  with_crew?: string;
  with_companies?: string;
  with_keywords?: string;
  page?: number;
}

export class TMDbService {
  private baseUrl = 'https://api.themoviedb.org/3';
  private imageBaseUrl = 'https://image.tmdb.org/t/p/';
  private apiKey: string | null = null;
  private configuration: TMDbConfiguration | null = null;
  private genreCache: Map<string, TMDbGenre[]> = new Map();
  private rateLimitDelay = 40; // 25 requests per second limit

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
    }
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    // Clear cache when API key changes
    this.genreCache.clear();
    this.configuration = null;
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('TMDb API key not configured');
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.append('api_key', this.apiKey);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString());
    });

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay));

    const response = await fetch(url.toString());

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid TMDb API key');
      } else if (response.status === 429) {
        throw new Error('TMDb API rate limit exceeded');
      } else {
        throw new Error(
          `TMDb API error: ${response.status} ${response.statusText}`
        );
      }
    }

    return response.json();
  }

  /**
   * Get TMDb configuration including image URLs
   */
  public async getConfiguration(): Promise<TMDbConfiguration> {
    if (this.configuration) {
      return this.configuration;
    }

    this.configuration =
      await this.makeRequest<TMDbConfiguration>('/configuration');
    return this.configuration;
  }

  /**
   * Search for movies
   */
  public async searchMovies(
    query: string,
    page = 1
  ): Promise<TMDbSearchResults<TMDbMovie>> {
    return this.makeRequest<TMDbSearchResults<TMDbMovie>>('/search/movie', {
      query,
      page,
    });
  }

  /**
   * Search for TV shows
   */
  public async searchTVShows(
    query: string,
    page = 1
  ): Promise<TMDbSearchResults<TMDbTVShow>> {
    return this.makeRequest<TMDbSearchResults<TMDbTVShow>>('/search/tv', {
      query,
      page,
    });
  }

  /**
   * Get movie details with credits
   */
  public async getMovieDetails(movieId: number): Promise<TMDbMovieDetails> {
    return this.makeRequest<TMDbMovieDetails>(`/movie/${movieId}`, {
      append_to_response: 'credits',
    });
  }

  /**
   * Get TV show details with credits
   */
  public async getTVShowDetails(tvId: number): Promise<any> {
    return this.makeRequest(`/tv/${tvId}`, {
      append_to_response: 'credits',
    });
  }

  /**
   * Get movie genres
   */
  public async getMovieGenres(): Promise<TMDbGenre[]> {
    if (this.genreCache.has('movie')) {
      return this.genreCache.get('movie')!;
    }

    const response = await this.makeRequest<{ genres: TMDbGenre[] }>(
      '/genre/movie/list'
    );
    this.genreCache.set('movie', response.genres);
    return response.genres;
  }

  /**
   * Get TV genres
   */
  public async getTVGenres(): Promise<TMDbGenre[]> {
    if (this.genreCache.has('tv')) {
      return this.genreCache.get('tv')!;
    }

    const response = await this.makeRequest<{ genres: TMDbGenre[] }>(
      '/genre/tv/list'
    );
    this.genreCache.set('tv', response.genres);
    return response.genres;
  }

  /**
   * Discover movies with filters
   */
  public async discoverMovies(
    options: TMDbDiscoverOptions = {}
  ): Promise<TMDbSearchResults<TMDbMovie>> {
    return this.makeRequest<TMDbSearchResults<TMDbMovie>>(
      '/discover/movie',
      options as Record<string, string | number>
    );
  }

  /**
   * Discover TV shows with filters
   */
  public async discoverTVShows(
    options: TMDbDiscoverOptions = {}
  ): Promise<TMDbSearchResults<TMDbTVShow>> {
    return this.makeRequest<TMDbSearchResults<TMDbTVShow>>(
      '/discover/tv',
      options as Record<string, string | number>
    );
  }

  /**
   * Get trending movies
   */
  public async getTrendingMovies(
    timeWindow: 'day' | 'week' = 'week',
    page = 1
  ): Promise<TMDbSearchResults<TMDbMovie>> {
    return this.makeRequest<TMDbSearchResults<TMDbMovie>>(
      `/trending/movie/${timeWindow}`,
      { page }
    );
  }

  /**
   * Get trending TV shows
   */
  public async getTrendingTVShows(
    timeWindow: 'day' | 'week' = 'week',
    page = 1
  ): Promise<TMDbSearchResults<TMDbTVShow>> {
    return this.makeRequest<TMDbSearchResults<TMDbTVShow>>(
      `/trending/tv/${timeWindow}`,
      { page }
    );
  }

  /**
   * Get popular movies
   */
  public async getPopularMovies(
    page = 1
  ): Promise<TMDbSearchResults<TMDbMovie>> {
    return this.makeRequest<TMDbSearchResults<TMDbMovie>>('/movie/popular', {
      page,
    });
  }

  /**
   * Get popular TV shows
   */
  public async getPopularTVShows(
    page = 1
  ): Promise<TMDbSearchResults<TMDbTVShow>> {
    return this.makeRequest<TMDbSearchResults<TMDbTVShow>>('/tv/popular', {
      page,
    });
  }

  /**
   * Get top rated movies
   */
  public async getTopRatedMovies(
    page = 1
  ): Promise<TMDbSearchResults<TMDbMovie>> {
    return this.makeRequest<TMDbSearchResults<TMDbMovie>>('/movie/top_rated', {
      page,
    });
  }

  /**
   * Get upcoming movies
   */
  public async getUpcomingMovies(
    page = 1
  ): Promise<TMDbSearchResults<TMDbMovie>> {
    return this.makeRequest<TMDbSearchResults<TMDbMovie>>('/movie/upcoming', {
      page,
    });
  }

  /**
   * Build full image URL
   */
  public async getImageUrl(
    path: string | null,
    size:
      | 'w92'
      | 'w154'
      | 'w185'
      | 'w342'
      | 'w500'
      | 'w780'
      | 'original' = 'w500'
  ): Promise<string | null> {
    if (!path) return null;

    const config = await this.getConfiguration();
    return `${config.images.secure_base_url}${size}${path}`;
  }

  /**
   * Validate API key
   */
  public async validateApiKey(): Promise<boolean> {
    try {
      await this.getConfiguration();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get API status and remaining quota (if available)
   */
  public async getApiStatus(): Promise<{
    valid: boolean;
    rateLimitRemaining?: number;
    rateLimitReset?: number;
  }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/configuration?api_key=${this.apiKey}`
      );

      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');

      return {
        valid: response.ok,
        ...(rateLimitRemaining && {
          rateLimitRemaining: parseInt(rateLimitRemaining),
        }),
        ...(rateLimitReset && { rateLimitReset: parseInt(rateLimitReset) }),
      };
    } catch (error) {
      return { valid: false };
    }
  }
}

// Export singleton instance
export const tmdbService = new TMDbService();
