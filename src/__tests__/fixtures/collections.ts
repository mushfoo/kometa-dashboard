export const mockCollections = [
  {
    id: '1',
    name: 'Marvel Cinematic Universe',
    type: 'smart',
    description: 'All movies in the Marvel Cinematic Universe',
    filters: {
      genre: ['Action', 'Adventure'],
      year: { min: 2008 },
      studio: ['Marvel Studios'],
    },
    sort: 'release.desc',
    visible: true,
    itemCount: 28,
    lastUpdated: new Date('2024-01-10T14:30:00Z').toISOString(),
  },
  {
    id: '2',
    name: 'Top Rated Movies',
    type: 'smart',
    description: 'Movies with rating 8.0 or higher',
    filters: {
      rating: { min: 8.0 },
      votes: { min: 10000 },
    },
    sort: 'rating.desc',
    visible: true,
    itemCount: 142,
    lastUpdated: new Date('2024-01-12T09:15:00Z').toISOString(),
  },
  {
    id: '3',
    name: 'Family Movie Night',
    type: 'manual',
    description: 'Hand-picked family-friendly movies',
    items: ['tt0114709', 'tt0120737', 'tt0266543', 'tt0317219'],
    visible: true,
    itemCount: 25,
    lastUpdated: new Date('2024-01-08T20:00:00Z').toISOString(),
  },
];

export const mockCollectionTemplates = [
  {
    id: 'tmpl_1',
    name: 'Decade Collections',
    description: 'Create collections for each decade',
    category: 'Time-based',
    template: {
      type: 'smart',
      filterTemplate: {
        year: { min: '{{decade_start}}', max: '{{decade_end}}' },
      },
      nameTemplate: '{{decade}}s Movies',
    },
  },
  {
    id: 'tmpl_2',
    name: 'Genre Collections',
    description: 'Create collections for each major genre',
    category: 'Genre-based',
    template: {
      type: 'smart',
      filterTemplate: {
        genre: ['{{genre}}'],
      },
      nameTemplate: '{{genre}} Movies',
    },
  },
];
