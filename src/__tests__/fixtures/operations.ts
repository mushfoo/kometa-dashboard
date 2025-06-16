export const mockOperations = [
  {
    id: 'op_1',
    type: 'full_scan',
    status: 'completed',
    startTime: new Date('2024-01-15T08:00:00Z').toISOString(),
    endTime: new Date('2024-01-15T09:30:00Z').toISOString(),
    duration: 5400000, // 1.5 hours in ms
    stats: {
      collectionsProcessed: 15,
      itemsAdded: 45,
      itemsRemoved: 3,
      errors: 0,
    },
  },
  {
    id: 'op_2',
    type: 'collection_update',
    status: 'running',
    startTime: new Date('2024-01-15T10:00:00Z').toISOString(),
    endTime: null,
    duration: null,
    progress: {
      current: 7,
      total: 15,
      currentCollection: 'Marvel Cinematic Universe',
    },
  },
  {
    id: 'op_3',
    type: 'metadata_refresh',
    status: 'failed',
    startTime: new Date('2024-01-14T22:00:00Z').toISOString(),
    endTime: new Date('2024-01-14T22:15:00Z').toISOString(),
    duration: 900000, // 15 minutes
    error: 'TMDb API rate limit exceeded',
  },
];

export const mockLogs = [
  {
    id: 'log_1',
    timestamp: new Date('2024-01-15T10:30:15.123Z').toISOString(),
    level: 'INFO',
    source: 'kometa.collections',
    message: 'Starting collection update for "Marvel Cinematic Universe"',
  },
  {
    id: 'log_2',
    timestamp: new Date('2024-01-15T10:30:16.456Z').toISOString(),
    level: 'DEBUG',
    source: 'kometa.api.tmdb',
    message: 'Fetching movie details for "Iron Man" (tt0371746)',
  },
  {
    id: 'log_3',
    timestamp: new Date('2024-01-15T10:30:17.789Z').toISOString(),
    level: 'WARNING',
    source: 'kometa.plex',
    message: 'Slow response from Plex server (3.2s)',
  },
  {
    id: 'log_4',
    timestamp: new Date('2024-01-15T10:30:18.012Z').toISOString(),
    level: 'ERROR',
    source: 'kometa.api.trakt',
    message: 'Failed to authenticate with Trakt: Invalid API key',
  },
];
