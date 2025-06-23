import {
  validateFilter,
  serializeFilterToKometa,
  isFilterGroup,
  isGenreFilter,
  isYearFilter,
  isRatingFilter,
  GenreFilter,
  YearFilter,
  RatingFilter,
  AvailabilityFilter,
  ContentTypeFilter,
  ResolutionFilter,
  FilterGroup,
} from '../filters';

describe('Filter Type Guards', () => {
  it('correctly identifies filter groups', () => {
    const filterGroup: FilterGroup = {
      id: 'group1',
      operator: 'AND',
      filters: [],
    };

    const genreFilter: GenreFilter = {
      id: 'filter1',
      field: 'genre',
      operator: 'contains',
      value: ['action'],
      enabled: true,
    };

    expect(isFilterGroup(filterGroup)).toBe(true);
    expect(isFilterGroup(genreFilter)).toBe(false);
  });

  it('correctly identifies genre filters', () => {
    const genreFilter: GenreFilter = {
      id: 'filter1',
      field: 'genre',
      operator: 'contains',
      value: ['action'],
      enabled: true,
    };

    const yearFilter: YearFilter = {
      id: 'filter2',
      field: 'year',
      operator: 'equals',
      value: 2023,
      enabled: true,
    };

    expect(isGenreFilter(genreFilter)).toBe(true);
    expect(isGenreFilter(yearFilter)).toBe(false);
  });

  it('correctly identifies year filters', () => {
    const yearFilter: YearFilter = {
      id: 'filter1',
      field: 'year',
      operator: 'equals',
      value: 2023,
      enabled: true,
    };

    const ratingFilter: RatingFilter = {
      id: 'filter2',
      field: 'rating',
      operator: 'greater_than',
      value: 7,
      enabled: true,
    };

    expect(isYearFilter(yearFilter)).toBe(true);
    expect(isYearFilter(ratingFilter)).toBe(false);
  });

  it('correctly identifies rating filters', () => {
    const ratingFilter: RatingFilter = {
      id: 'filter1',
      field: 'rating',
      operator: 'greater_than',
      value: 7,
      enabled: true,
    };

    const genreFilter: GenreFilter = {
      id: 'filter2',
      field: 'genre',
      operator: 'contains',
      value: ['action'],
      enabled: true,
    };

    expect(isRatingFilter(ratingFilter)).toBe(true);
    expect(isRatingFilter(genreFilter)).toBe(false);
  });
});

describe('Filter Validation', () => {
  describe('Genre Filter', () => {
    it('validates valid genre filter', () => {
      const filter: GenreFilter = {
        id: '1',
        field: 'genre',
        operator: 'contains',
        value: ['action', 'comedy'],
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(true);
    });

    it('invalidates empty genre array', () => {
      const filter: GenreFilter = {
        id: '1',
        field: 'genre',
        operator: 'contains',
        value: [],
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(false);
    });
  });

  describe('Year Filter', () => {
    it('validates valid single year', () => {
      const filter: YearFilter = {
        id: '1',
        field: 'year',
        operator: 'equals',
        value: 2023,
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(true);
    });

    it('validates valid year range', () => {
      const filter: YearFilter = {
        id: '1',
        field: 'year',
        operator: 'between',
        value: [2000, 2023],
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(true);
    });

    it('invalidates year too old', () => {
      const filter: YearFilter = {
        id: '1',
        field: 'year',
        operator: 'equals',
        value: 1700,
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(false);
    });

    it('invalidates year too far in future', () => {
      const filter: YearFilter = {
        id: '1',
        field: 'year',
        operator: 'equals',
        value: new Date().getFullYear() + 10,
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(false);
    });

    it('invalidates inverted year range', () => {
      const filter: YearFilter = {
        id: '1',
        field: 'year',
        operator: 'between',
        value: [2023, 2000],
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(false);
    });
  });

  describe('Rating Filter', () => {
    it('validates valid single rating', () => {
      const filter: RatingFilter = {
        id: '1',
        field: 'rating',
        operator: 'greater_than',
        value: 7.5,
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(true);
    });

    it('validates valid rating range', () => {
      const filter: RatingFilter = {
        id: '1',
        field: 'rating',
        operator: 'between',
        value: [6, 9],
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(true);
    });

    it('invalidates rating below 0', () => {
      const filter: RatingFilter = {
        id: '1',
        field: 'rating',
        operator: 'equals',
        value: -1,
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(false);
    });

    it('invalidates rating above 10', () => {
      const filter: RatingFilter = {
        id: '1',
        field: 'rating',
        operator: 'equals',
        value: 11,
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(false);
    });
  });

  describe('Other Filters', () => {
    it('validates availability filter', () => {
      const filter: AvailabilityFilter = {
        id: '1',
        field: 'availability',
        operator: 'equals',
        value: ['netflix', 'hulu'],
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(true);
    });

    it('validates content type filter', () => {
      const filter: ContentTypeFilter = {
        id: '1',
        field: 'content_type',
        operator: 'equals',
        value: 'movie',
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(true);
    });

    it('validates resolution filter', () => {
      const filter: ResolutionFilter = {
        id: '1',
        field: 'resolution',
        operator: 'equals',
        value: '1080p',
        enabled: true,
      };

      expect(validateFilter(filter)).toBe(true);
    });
  });
});

describe('Filter Serialization', () => {
  it('serializes genre filter', () => {
    const filter: GenreFilter = {
      id: '1',
      field: 'genre',
      operator: 'contains',
      value: ['action', 'comedy'],
      enabled: true,
    };

    expect(serializeFilterToKometa(filter)).toEqual({
      genre: 'action',
    });
  });

  it('serializes year filter with equals', () => {
    const filter: YearFilter = {
      id: '1',
      field: 'year',
      operator: 'equals',
      value: 2023,
      enabled: true,
    };

    expect(serializeFilterToKometa(filter)).toEqual({
      year: 2023,
    });
  });

  it('serializes year filter with greater_than', () => {
    const filter: YearFilter = {
      id: '1',
      field: 'year',
      operator: 'greater_than',
      value: 2020,
      enabled: true,
    };

    expect(serializeFilterToKometa(filter)).toEqual({
      'year.gte': 2020,
    });
  });

  it('serializes year filter with less_than', () => {
    const filter: YearFilter = {
      id: '1',
      field: 'year',
      operator: 'less_than',
      value: 2020,
      enabled: true,
    };

    expect(serializeFilterToKometa(filter)).toEqual({
      'year.lte': 2020,
    });
  });

  it('serializes year filter with between', () => {
    const filter: YearFilter = {
      id: '1',
      field: 'year',
      operator: 'between',
      value: [2000, 2020],
      enabled: true,
    };

    expect(serializeFilterToKometa(filter)).toEqual({
      'year.gte': 2000,
      'year.lte': 2020,
    });
  });

  it('serializes rating filter', () => {
    const filter: RatingFilter = {
      id: '1',
      field: 'rating',
      operator: 'greater_than',
      value: 7,
      enabled: true,
    };

    expect(serializeFilterToKometa(filter)).toEqual({
      'user_rating.gte': 7,
    });
  });

  it('serializes availability filter', () => {
    const filter: AvailabilityFilter = {
      id: '1',
      field: 'availability',
      operator: 'equals',
      value: ['netflix', 'hulu'],
      enabled: true,
    };

    expect(serializeFilterToKometa(filter)).toEqual({
      streaming: 'netflix',
    });
  });

  it('serializes content type filter', () => {
    const filter: ContentTypeFilter = {
      id: '1',
      field: 'content_type',
      operator: 'equals',
      value: 'movie',
      enabled: true,
    };

    expect(serializeFilterToKometa(filter)).toEqual({
      type: 'movie',
    });
  });

  it('serializes resolution filter', () => {
    const filter: ResolutionFilter = {
      id: '1',
      field: 'resolution',
      operator: 'equals',
      value: '1080p',
      enabled: true,
    };

    expect(serializeFilterToKometa(filter)).toEqual({
      resolution: '1080p',
    });
  });
});
