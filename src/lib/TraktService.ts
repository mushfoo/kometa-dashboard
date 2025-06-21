/**
 * Trakt API Integration Service
 * Provides user list and recommendation functionality from Trakt.tv
 */

export interface TraktIds {
  trakt: number;
  slug: string;
  tvdb?: number;
  imdb?: string;
  tmdb?: number;
}

export interface TraktMovie {
  title: string;
  year: number;
  ids: TraktIds;
  tagline?: string;
  overview?: string;
  released?: string;
  runtime?: number;
  rating?: number;
  votes?: number;
  genres?: string[];
  language?: string;
  trailer?: string;
  homepage?: string;
}

export interface TraktShow {
  title: string;
  year: number;
  ids: TraktIds;
  overview?: string;
  first_aired?: string;
  airs?: {
    day: string;
    time: string;
    timezone: string;
  };
  runtime?: number;
  certification?: string;
  network?: string;
  country?: string;
  trailer?: string;
  homepage?: string;
  status?: string;
  rating?: number;
  votes?: number;
  genres?: string[];
  language?: string;
}

export interface TraktListItem {
  rank?: number;
  id?: number;
  listed_at: string;
  type: 'movie' | 'show' | 'season' | 'episode';
  movie?: TraktMovie;
  show?: TraktShow;
  notes?: string;
}

export interface TraktList {
  name: string;
  slug: string;
  description?: string;
  privacy: 'private' | 'friends' | 'public';
  display_numbers: boolean;
  allow_comments: boolean;
  sort_by: string;
  sort_how: string;
  created_at: string;
  updated_at: string;
  item_count: number;
  comment_count: number;
  like_count: number;
  ids: {
    trakt: number;
    slug: string;
  };
  user: {
    username: string;
    private: boolean;
    name: string;
    vip: boolean;
    vip_ep: boolean;
  };
}

export interface TraktRecommendation {
  type: 'movie' | 'show';
  movie?: TraktMovie;
  show?: TraktShow;
  user_count: number;
}

export interface TraktCredentials {
  client_id: string;
  client_secret?: string;
  access_token?: string;
  refresh_token?: string;
}

export interface TraktStats {
  movies: {
    plays: number;
    watched: number;
    minutes: number;
    collected: number;
    ratings: number;
    comments: number;
  };
  shows: {
    watched: number;
    collected: number;
    ratings: number;
    comments: number;
  };
  seasons: {
    ratings: number;
    comments: number;
  };
  episodes: {
    plays: number;
    watched: number;
    minutes: number;
    collected: number;
    ratings: number;
    comments: number;
  };
}

export class TraktService {
  private baseUrl = 'https://api.trakt.tv';
  private credentials: TraktCredentials | null = null;
  private rateLimitDelay = 50; // 20 requests per second limit

  constructor(credentials?: TraktCredentials) {
    if (credentials) {
      this.credentials = credentials;
    }
  }

  public setCredentials(credentials: TraktCredentials): void {
    this.credentials = credentials;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth = false
  ): Promise<T> {
    if (!this.credentials?.client_id) {
      throw new Error('Trakt client ID not configured');
    }

    if (requireAuth && !this.credentials.access_token) {
      throw new Error('Trakt access token required for this operation');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': this.credentials.client_id,
      ...(options.headers as Record<string, string>),
    };

    if (this.credentials.access_token && requireAuth) {
      headers['Authorization'] = `Bearer ${this.credentials.access_token}`;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay));

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid Trakt credentials or expired token');
      } else if (response.status === 403) {
        throw new Error('Trakt API access forbidden');
      } else if (response.status === 429) {
        throw new Error('Trakt API rate limit exceeded');
      } else {
        throw new Error(
          `Trakt API error: ${response.status} ${response.statusText}`
        );
      }
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  /**
   * Search for movies
   */
  public async searchMovies(
    query: string,
    options: { type?: 'movie'; extended?: 'full' } = {}
  ): Promise<TraktMovie[]> {
    const params = new URLSearchParams({
      query,
      type: options.type || 'movie',
      ...(options.extended && { extended: options.extended }),
    });

    const results = await this.makeRequest<{ movie: TraktMovie }[]>(
      `/search/movie?${params.toString()}`
    );

    return results.map((item) => item.movie);
  }

  /**
   * Search for TV shows
   */
  public async searchShows(
    query: string,
    options: { type?: 'show'; extended?: 'full' } = {}
  ): Promise<TraktShow[]> {
    const params = new URLSearchParams({
      query,
      type: options.type || 'show',
      ...(options.extended && { extended: options.extended }),
    });

    const results = await this.makeRequest<{ show: TraktShow }[]>(
      `/search/show?${params.toString()}`
    );

    return results.map((item) => item.show);
  }

  /**
   * Get user's watchlist
   */
  public async getUserWatchlist(
    username: string,
    type: 'movies' | 'shows' = 'movies'
  ): Promise<TraktListItem[]> {
    return this.makeRequest<TraktListItem[]>(
      `/users/${username}/watchlist/${type}`,
      {},
      true
    );
  }

  /**
   * Get user's favorites/collection
   */
  public async getUserCollection(
    username: string,
    type: 'movies' | 'shows' = 'movies'
  ): Promise<TraktListItem[]> {
    return this.makeRequest<TraktListItem[]>(
      `/users/${username}/collection/${type}`,
      {},
      true
    );
  }

  /**
   * Get user's custom lists
   */
  public async getUserLists(username: string): Promise<TraktList[]> {
    return this.makeRequest<TraktList[]>(`/users/${username}/lists`);
  }

  /**
   * Get items from a specific user list
   */
  public async getListItems(
    username: string,
    listSlug: string
  ): Promise<TraktListItem[]> {
    return this.makeRequest<TraktListItem[]>(
      `/users/${username}/lists/${listSlug}/items`
    );
  }

  /**
   * Get trending movies
   */
  public async getTrendingMovies(extended?: 'full'): Promise<TraktMovie[]> {
    const params = extended ? `?extended=${extended}` : '';
    const results = await this.makeRequest<{ movie: TraktMovie }[]>(
      `/movies/trending${params}`
    );
    return results.map((item) => item.movie);
  }

  /**
   * Get trending shows
   */
  public async getTrendingShows(extended?: 'full'): Promise<TraktShow[]> {
    const params = extended ? `?extended=${extended}` : '';
    const results = await this.makeRequest<{ show: TraktShow }[]>(
      `/shows/trending${params}`
    );
    return results.map((item) => item.show);
  }

  /**
   * Get popular movies
   */
  public async getPopularMovies(extended?: 'full'): Promise<TraktMovie[]> {
    const params = extended ? `?extended=${extended}` : '';
    return this.makeRequest<TraktMovie[]>(`/movies/popular${params}`);
  }

  /**
   * Get popular shows
   */
  public async getPopularShows(extended?: 'full'): Promise<TraktShow[]> {
    const params = extended ? `?extended=${extended}` : '';
    return this.makeRequest<TraktShow[]>(`/shows/popular${params}`);
  }

  /**
   * Get movie recommendations for authenticated user
   */
  public async getMovieRecommendations(): Promise<TraktMovie[]> {
    return this.makeRequest<TraktMovie[]>('/recommendations/movies', {}, true);
  }

  /**
   * Get show recommendations for authenticated user
   */
  public async getShowRecommendations(): Promise<TraktShow[]> {
    return this.makeRequest<TraktShow[]>('/recommendations/shows', {}, true);
  }

  /**
   * Get user statistics
   */
  public async getUserStats(username: string): Promise<TraktStats> {
    return this.makeRequest<TraktStats>(`/users/${username}/stats`);
  }

  /**
   * Get movie details
   */
  public async getMovie(
    id: string | number,
    extended?: 'full'
  ): Promise<TraktMovie> {
    const params = extended ? `?extended=${extended}` : '';
    return this.makeRequest<TraktMovie>(`/movies/${id}${params}`);
  }

  /**
   * Get show details
   */
  public async getShow(
    id: string | number,
    extended?: 'full'
  ): Promise<TraktShow> {
    const params = extended ? `?extended=${extended}` : '';
    return this.makeRequest<TraktShow>(`/shows/${id}${params}`);
  }

  /**
   * Validate API credentials
   */
  public async validateCredentials(): Promise<boolean> {
    try {
      // Try to get trending movies (public endpoint)
      await this.getTrendingMovies();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get API status
   */
  public async getApiStatus(): Promise<{
    valid: boolean;
    authenticated: boolean;
    rateLimitRemaining?: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/movies/trending?limit=1`, {
        headers: {
          'trakt-api-version': '2',
          'trakt-api-key': this.credentials?.client_id || '',
          ...(this.credentials?.access_token && {
            Authorization: `Bearer ${this.credentials.access_token}`,
          }),
        },
      });

      const rateLimitRemaining = response.headers.get('X-Ratelimit-Remaining');

      return {
        valid: response.ok,
        authenticated: !!this.credentials?.access_token,
        ...(rateLimitRemaining && {
          rateLimitRemaining: parseInt(rateLimitRemaining),
        }),
      };
    } catch (error) {
      return {
        valid: false,
        authenticated: false,
      };
    }
  }

  /**
   * Convert Trakt movie to collection filter compatible format
   */
  public traktMovieToFilterData(movie: TraktMovie) {
    return {
      title: movie.title,
      year: movie.year,
      tmdb_id: movie.ids.tmdb,
      imdb_id: movie.ids.imdb,
      trakt_id: movie.ids.trakt,
      genres: movie.genres || [],
      rating: movie.rating,
    };
  }

  /**
   * Convert Trakt show to collection filter compatible format
   */
  public traktShowToFilterData(show: TraktShow) {
    return {
      title: show.title,
      year: show.year,
      tmdb_id: show.ids.tmdb,
      imdb_id: show.ids.imdb,
      trakt_id: show.ids.trakt,
      genres: show.genres || [],
      rating: show.rating,
      network: show.network,
      status: show.status,
    };
  }
}

// Export singleton instance
export const traktService = new TraktService();
