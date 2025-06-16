export const mockPlexConfig = {
  url: 'http://localhost:32400',
  token: 'test-token-123',
};

export const mockLibraries = [
  {
    id: '1',
    name: 'Movies',
    type: 'movie',
    itemCount: 1250,
    lastScan: new Date('2024-01-15T10:30:00Z').toISOString(),
  },
  {
    id: '2',
    name: 'TV Shows',
    type: 'show',
    itemCount: 350,
    lastScan: new Date('2024-01-15T09:15:00Z').toISOString(),
  },
  {
    id: '3',
    name: 'Anime',
    type: 'show',
    itemCount: 175,
    lastScan: new Date('2024-01-14T18:45:00Z').toISOString(),
  },
];

export const mockKometaConfig = {
  plex: mockPlexConfig,
  libraries: mockLibraries.map((lib) => lib.name),
  settings: {
    cache: true,
    cache_expiration: 60,
    asset_directory: './assets',
    missing_path: './missing',
    sync_mode: 'sync',
    default_collection_order: 'alpha',
  },
  tmdb: {
    apikey: '***',
    language: 'en',
  },
  trakt: {
    client_id: '***',
    client_secret: '***',
    pin: null,
  },
};
