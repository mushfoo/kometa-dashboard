export const testData = {
  plex: {
    validUrl: 'http://localhost:32400',
    invalidUrl: 'not-a-valid-url',
    validToken: '1234567890abcdef1234567890abcdef',
    invalidToken: 'invalid-token',
    testLibraries: [
      { key: '1', title: 'Movies', type: 'movie' },
      { key: '2', title: 'TV Shows', type: 'show' },
      { key: '3', title: 'Music', type: 'artist' },
    ],
  },
  apiKeys: {
    tmdb: {
      valid: '1234567890abcdef1234567890abcdef',
      invalid: 'invalid-tmdb-key',
    },
    trakt: {
      validClientId: 'valid-trakt-client-id',
      validClientSecret: 'valid-trakt-client-secret',
      invalidClientId: 'invalid',
      invalidClientSecret: 'invalid',
    },
    imdb: {
      valid: 'valid-imdb-key',
      invalid: 'invalid-imdb-key',
    },
  },
  yaml: {
    valid: `
libraries:
  Movies:
    collection_files:
      - default: basic
settings:
  cache: true
plex:
  url: http://localhost:32400
  token: test-token
`,
    invalid: `
libraries:
  Movies:
    collection_files
      - default: basic  # Missing colon
`,
    large: `
# Large YAML file for performance testing
libraries:
  Movies:
    collection_files:
      - default: basic
      - default: imdb
      - default: seasonal
      - default: streaming
    operations:
      mass_genre_update: tmdb
      mass_content_rating_update: mdb_commonsense
      mass_audience_rating_update: imdb
  TV Shows:
    collection_files:
      - default: basic
      - default: network
      - default: streaming
    operations:
      mass_genre_update: tmdb
settings:
  cache: true
  cache_expiration: 60
`.repeat(10), // Repeat to make it larger
  },
  errors: {
    networkError: 'Network request failed',
    validationError: 'Validation failed',
    serverError: 'Internal server error',
  },
};
