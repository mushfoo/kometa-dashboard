import {
  serializeFilterToKometa,
  serializeFilterGroupToKometa,
  CollectionFilter,
  FilterGroup,
} from '../../types/filters';

describe('Filter Serialization', () => {
  describe('serializeFilterToKometa', () => {
    describe('field mappings', () => {
      it('should map rating to user_rating', () => {
        const filter: CollectionFilter = {
          field: 'rating',
          operator: 'equals',
          value: 8.5,
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ user_rating: 8.5 });
      });

      it('should map date_added to added', () => {
        const filter: CollectionFilter = {
          field: 'date_added',
          operator: 'equals',
          value: '2024-01-01',
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ added: '2024-01-01' });
      });

      it('should map date_released to release', () => {
        const filter: CollectionFilter = {
          field: 'date_released',
          operator: 'equals',
          value: '2023-12-25',
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ release: '2023-12-25' });
      });

      it('should keep genre mapping unchanged', () => {
        const filter: CollectionFilter = {
          field: 'genre',
          operator: 'equals',
          value: 'Action',
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ genre: 'Action' });
      });
    });

    describe('dot notation operators', () => {
      it('should generate proper dot notation for greater_than operator', () => {
        const filter: CollectionFilter = {
          field: 'rating',
          operator: 'greater_than',
          value: 7.0,
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ 'user_rating.gte': 7.0 });
      });

      it('should generate proper dot notation for less_than operator', () => {
        const filter: CollectionFilter = {
          field: 'year',
          operator: 'less_than',
          value: 2020,
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ 'year.lte': 2020 });
      });

      it('should generate proper dot notation for between operator', () => {
        const filter: CollectionFilter = {
          field: 'year',
          operator: 'between',
          value: [2000, 2020],
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({
          'year.gte': 2000,
          'year.lte': 2020,
        });
      });
    });

    describe('exclusion filters', () => {
      it('should handle excluded genre filters', () => {
        const filter: CollectionFilter = {
          field: 'genre',
          operator: 'equals',
          value: 'Horror',
          ruleOperator: 'exclude',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ 'genre.not': 'Horror' });
      });

      it('should handle excluded rating filters with operators', () => {
        const filter: CollectionFilter = {
          field: 'rating',
          operator: 'greater_than',
          value: 9.0,
          ruleOperator: 'exclude',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ 'user_rating.not.gte': 9.0 });
      });
    });

    describe('all field types', () => {
      const testCases = [
        { field: 'director', expected: 'director' },
        { field: 'actor', expected: 'actor' },
        { field: 'studio', expected: 'studio' },
        { field: 'resolution', expected: 'resolution' },
        { field: 'content_type', expected: 'type' },
        { field: 'availability', expected: 'streaming' },
      ] as const;

      testCases.forEach(({ field, expected }) => {
        it(`should map ${field} to ${expected}`, () => {
          const filter: CollectionFilter = {
            field,
            operator: 'equals',
            value: 'test-value',
            ruleOperator: 'include',
          };

          const result = serializeFilterToKometa(filter);
          expect(result).toEqual({ [expected]: 'test-value' });
        });
      });
    });
  });

  describe('serializeFilterGroupToKometa', () => {
    it('should flatten single filter to direct properties', () => {
      const group: FilterGroup = {
        operator: 'AND',
        filters: [
          {
            field: 'genre',
            operator: 'equals',
            value: 'Action',
            ruleOperator: 'include',
          },
        ],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({ genre: 'Action' });
    });

    it('should flatten multiple AND filters to direct properties', () => {
      const group: FilterGroup = {
        operator: 'AND',
        filters: [
          {
            field: 'genre',
            operator: 'equals',
            value: 'Action',
            ruleOperator: 'include',
          },
          {
            field: 'year',
            operator: 'greater_than',
            value: 2000,
            ruleOperator: 'include',
          },
          {
            field: 'rating',
            operator: 'greater_than',
            value: 7.0,
            ruleOperator: 'include',
          },
        ],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({
        genre: 'Action',
        'year.gte': 2000,
        'user_rating.gte': 7.0,
      });
    });

    it('should use any structure for OR filters with multiple items', () => {
      const group: FilterGroup = {
        operator: 'OR',
        filters: [
          {
            field: 'genre',
            operator: 'equals',
            value: 'Action',
            ruleOperator: 'include',
          },
          {
            field: 'genre',
            operator: 'equals',
            value: 'Comedy',
            ruleOperator: 'include',
          },
        ],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({
        any: [{ genre: 'Action' }, { genre: 'Comedy' }],
      });
    });

    it('should flatten single OR filter to direct properties', () => {
      const group: FilterGroup = {
        operator: 'OR',
        filters: [
          {
            field: 'genre',
            operator: 'equals',
            value: 'Action',
            ruleOperator: 'include',
          },
        ],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({ genre: 'Action' });
    });

    it('should handle nested filter groups', () => {
      const nestedGroup: FilterGroup = {
        operator: 'AND',
        filters: [
          {
            field: 'year',
            operator: 'greater_than',
            value: 2010,
            ruleOperator: 'include',
          },
          {
            field: 'rating',
            operator: 'greater_than',
            value: 8.0,
            ruleOperator: 'include',
          },
        ],
      };

      const mainGroup: FilterGroup = {
        operator: 'AND',
        filters: [
          {
            field: 'genre',
            operator: 'equals',
            value: 'Drama',
            ruleOperator: 'include',
          },
          nestedGroup,
        ],
      };

      const result = serializeFilterGroupToKometa(mainGroup);
      expect(result).toEqual({
        genre: 'Drama',
        'year.gte': 2010,
        'user_rating.gte': 8.0,
      });
    });

    it('should return empty object for empty filter group', () => {
      const group: FilterGroup = {
        operator: 'AND',
        filters: [],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({});
    });

    it('should handle complex filter combinations', () => {
      const group: FilterGroup = {
        operator: 'AND',
        filters: [
          {
            field: 'genre',
            operator: 'equals',
            value: 'Sci-Fi',
            ruleOperator: 'include',
          },
          {
            field: 'year',
            operator: 'between',
            value: [2010, 2020],
            ruleOperator: 'include',
          },
          {
            field: 'rating',
            operator: 'greater_than',
            value: 7.5,
            ruleOperator: 'include',
          },
          {
            field: 'director',
            operator: 'equals',
            value: 'Christopher Nolan',
            ruleOperator: 'exclude',
          },
        ],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({
        genre: 'Sci-Fi',
        'year.gte': 2010,
        'year.lte': 2020,
        'user_rating.gte': 7.5,
        'director.not': 'Christopher Nolan',
      });
    });
  });

  describe('Kometa format validation', () => {
    it('should generate valid Kometa collection structure', () => {
      const filters: FilterGroup = {
        operator: 'AND',
        filters: [
          {
            field: 'genre',
            operator: 'equals',
            value: 'Action',
            ruleOperator: 'include',
          },
          {
            field: 'rating',
            operator: 'greater_than',
            value: 7.0,
            ruleOperator: 'include',
          },
          {
            field: 'year',
            operator: 'greater_than',
            value: 2000,
            ruleOperator: 'include',
          },
        ],
      };

      const kometaFilters = serializeFilterGroupToKometa(filters);

      // Verify our filters match the expected Kometa structure
      expect(kometaFilters).toEqual({
        genre: 'Action',
        'user_rating.gte': 7.0,
        'year.gte': 2000,
      });
    });
  });
});
