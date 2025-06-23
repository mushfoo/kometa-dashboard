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
          id: '1',
          field: 'rating',
          operator: 'equals',
          value: 8.5,
          enabled: true,
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ user_rating: 8.5 });
      });

      it('should map date_added to added', () => {
        const filter: CollectionFilter = {
          id: '2',
          field: 'date_added',
          operator: 'equals',
          value: '2024-01-01',
          enabled: true,
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ added: '2024-01-01' });
      });

      it('should map date_released to release', () => {
        const filter: CollectionFilter = {
          id: '3',
          field: 'date_released',
          operator: 'equals',
          value: '2023-12-25',
          enabled: true,
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ release: '2023-12-25' });
      });

      it('should keep genre mapping unchanged', () => {
        const filter: CollectionFilter = {
          id: '4',
          field: 'genre',
          operator: 'equals',
          value: ['Action'],
          enabled: true,
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ genre: ['Action'] });
      });
    });

    describe('dot notation operators', () => {
      it('should generate proper dot notation for greater_than operator', () => {
        const filter: CollectionFilter = {
          id: '5',
          field: 'rating',
          operator: 'greater_than',
          value: 7.0,
          enabled: true,
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ 'user_rating.gte': 7.0 });
      });

      it('should generate proper dot notation for less_than operator', () => {
        const filter: CollectionFilter = {
          id: '6',
          field: 'year',
          operator: 'less_than',
          value: 2020,
          enabled: true,
          ruleOperator: 'include',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ 'year.lte': 2020 });
      });

      it('should generate proper dot notation for between operator', () => {
        const filter: CollectionFilter = {
          id: '7',
          field: 'year',
          operator: 'between',
          value: [2000, 2020],
          enabled: true,
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
          id: '8',
          field: 'genre',
          operator: 'equals',
          value: ['Horror'],
          enabled: true,
          ruleOperator: 'exclude',
        };

        const result = serializeFilterToKometa(filter);
        expect(result).toEqual({ 'genre.not': ['Horror'] });
      });

      it('should handle excluded rating filters with operators', () => {
        const filter: CollectionFilter = {
          id: '9',
          field: 'rating',
          operator: 'greater_than',
          value: 9.0,
          enabled: true,
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
            id: `test-${field}`,
            field,
            operator: 'equals',
            value:
              field === 'availability'
                ? ['test-value']
                : field === 'content_type'
                  ? 'movie'
                  : field === 'resolution'
                    ? '1080p'
                    : ['test-value'],
            enabled: true,
            ruleOperator: 'include',
          } as CollectionFilter;

          const result = serializeFilterToKometa(filter);
          const expectedValue =
            field === 'resolution'
              ? '1080p'
              : field === 'content_type'
                ? 'movie'
                : field === 'availability'
                  ? ['test-value']
                  : ['test-value'];
          expect(result).toEqual({ [expected]: expectedValue });
        });
      });
    });
  });

  describe('serializeFilterGroupToKometa', () => {
    it('should flatten single filter to direct properties', () => {
      const group: FilterGroup = {
        id: 'group-1',
        operator: 'AND',
        filters: [
          {
            id: '10',
            field: 'genre',
            operator: 'equals',
            value: ['Action'],
            enabled: true,
            ruleOperator: 'include',
          },
        ],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({ genre: ['Action'] });
    });

    it('should flatten multiple AND filters to direct properties', () => {
      const group: FilterGroup = {
        id: 'group-2',
        operator: 'AND',
        filters: [
          {
            id: '11',
            field: 'genre',
            operator: 'equals',
            value: ['Action'],
            enabled: true,
            ruleOperator: 'include',
          },
          {
            id: '12',
            field: 'year',
            operator: 'greater_than',
            value: 2000,
            enabled: true,
            ruleOperator: 'include',
          },
          {
            id: '13',
            field: 'rating',
            operator: 'greater_than',
            value: 7.0,
            enabled: true,
            ruleOperator: 'include',
          },
        ],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({
        genre: ['Action'],
        'year.gte': 2000,
        'user_rating.gte': 7.0,
      });
    });

    it('should use any structure for OR filters with multiple items', () => {
      const group: FilterGroup = {
        id: 'group-3',
        operator: 'OR',
        filters: [
          {
            id: '14',
            field: 'genre',
            operator: 'equals',
            value: ['Action'],
            enabled: true,
            ruleOperator: 'include',
          },
          {
            id: '15',
            field: 'genre',
            operator: 'equals',
            value: ['Comedy'],
            enabled: true,
            ruleOperator: 'include',
          },
        ],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({
        any: [{ genre: ['Action'] }, { genre: ['Comedy'] }],
      });
    });

    it('should flatten single OR filter to direct properties', () => {
      const group: FilterGroup = {
        id: 'group-4',
        operator: 'OR',
        filters: [
          {
            id: '16',
            field: 'genre',
            operator: 'equals',
            value: ['Action'],
            enabled: true,
            ruleOperator: 'include',
          },
        ],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({ genre: ['Action'] });
    });

    it('should handle nested filter groups', () => {
      const nestedGroup: FilterGroup = {
        id: 'nested-group',
        operator: 'AND',
        filters: [
          {
            id: '17',
            field: 'year',
            operator: 'greater_than',
            value: 2010,
            enabled: true,
            ruleOperator: 'include',
          },
          {
            id: '18',
            field: 'rating',
            operator: 'greater_than',
            value: 8.0,
            enabled: true,
            ruleOperator: 'include',
          },
        ],
      };

      const mainGroup: FilterGroup = {
        id: 'main-group',
        operator: 'AND',
        filters: [
          {
            id: '19',
            field: 'genre',
            operator: 'equals',
            value: ['Drama'],
            enabled: true,
            ruleOperator: 'include',
          },
          nestedGroup,
        ],
      };

      const result = serializeFilterGroupToKometa(mainGroup);
      expect(result).toEqual({
        genre: ['Drama'],
        'year.gte': 2010,
        'user_rating.gte': 8.0,
      });
    });

    it('should return empty object for empty filter group', () => {
      const group: FilterGroup = {
        id: 'empty-group',
        operator: 'AND',
        filters: [],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({});
    });

    it('should handle complex filter combinations', () => {
      const group: FilterGroup = {
        id: 'complex-group',
        operator: 'AND',
        filters: [
          {
            id: '21',
            field: 'genre',
            operator: 'equals',
            value: ['Sci-Fi'],
            enabled: true,
            ruleOperator: 'include',
          },
          {
            id: '22',
            field: 'year',
            operator: 'between',
            value: [2010, 2020],
            enabled: true,
            ruleOperator: 'include',
          },
          {
            id: '23',
            field: 'rating',
            operator: 'greater_than',
            value: 7.5,
            enabled: true,
            ruleOperator: 'include',
          },
          {
            id: '24',
            field: 'director',
            operator: 'equals',
            value: ['Christopher Nolan'],
            enabled: true,
            ruleOperator: 'exclude',
          },
        ],
      };

      const result = serializeFilterGroupToKometa(group);
      expect(result).toEqual({
        genre: ['Sci-Fi'],
        'year.gte': 2010,
        'year.lte': 2020,
        'user_rating.gte': 7.5,
        'director.not': ['Christopher Nolan'],
      });
    });
  });

  describe('Kometa format validation', () => {
    it('should generate valid Kometa collection structure', () => {
      const filters: FilterGroup = {
        id: 'validation-group',
        operator: 'AND',
        filters: [
          {
            id: '25',
            field: 'genre',
            operator: 'equals',
            value: ['Action'],
            enabled: true,
            ruleOperator: 'include',
          },
          {
            id: '26',
            field: 'rating',
            operator: 'greater_than',
            value: 7.0,
            enabled: true,
            ruleOperator: 'include',
          },
          {
            id: '27',
            field: 'year',
            operator: 'greater_than',
            value: 2000,
            enabled: true,
            ruleOperator: 'include',
          },
        ],
      };

      const kometaFilters = serializeFilterGroupToKometa(filters);

      // Verify our filters match the expected Kometa structure
      expect(kometaFilters).toEqual({
        genre: ['Action'],
        'user_rating.gte': 7.0,
        'year.gte': 2000,
      });
    });
  });
});
