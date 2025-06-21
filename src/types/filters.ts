/**
 * Filter system types for the Collection Builder
 */

export type FilterOperator = 'AND' | 'OR';
export type ComparisonOperator =
  | 'equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'between';

export interface BaseFilter {
  id: string;
  field: string;
  operator: ComparisonOperator;
  value: unknown;
  enabled: boolean;
}

export interface GenreFilter extends BaseFilter {
  field: 'genre';
  operator: 'equals' | 'contains';
  value: string[];
}

export interface YearFilter extends BaseFilter {
  field: 'year';
  operator: 'equals' | 'greater_than' | 'less_than' | 'between';
  value: number | [number, number];
}

export interface RatingFilter extends BaseFilter {
  field: 'rating';
  operator: 'equals' | 'greater_than' | 'less_than' | 'between';
  value: number | [number, number];
}

export interface AvailabilityFilter extends BaseFilter {
  field: 'availability';
  operator: 'equals';
  value: string[]; // Platform names like 'netflix', 'hulu', etc.
}

export interface ContentTypeFilter extends BaseFilter {
  field: 'content_type';
  operator: 'equals';
  value: 'movie' | 'show' | 'season' | 'episode';
}

export interface ResolutionFilter extends BaseFilter {
  field: 'resolution';
  operator: 'equals' | 'greater_than';
  value: '4K' | '1080p' | '720p' | '480p' | 'SD';
}

export type CollectionFilter =
  | GenreFilter
  | YearFilter
  | RatingFilter
  | AvailabilityFilter
  | ContentTypeFilter
  | ResolutionFilter;

export interface FilterGroup {
  id: string;
  operator: FilterOperator;
  filters: (CollectionFilter | FilterGroup)[];
}

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filterGroup: FilterGroup;
  createdAt: string;
  updatedAt: string;
}

export interface FilterState {
  activeFilters: FilterGroup;
  presets: FilterPreset[];
  isDirty: boolean;
}

// Helper type guards
export const isFilterGroup = (
  filter: CollectionFilter | FilterGroup
): filter is FilterGroup => {
  return 'filters' in filter && Array.isArray(filter.filters);
};

export const isGenreFilter = (
  filter: CollectionFilter
): filter is GenreFilter => {
  return filter.field === 'genre';
};

export const isYearFilter = (
  filter: CollectionFilter
): filter is YearFilter => {
  return filter.field === 'year';
};

export const isRatingFilter = (
  filter: CollectionFilter
): filter is RatingFilter => {
  return filter.field === 'rating';
};

// Filter validation helpers
export const validateFilter = (filter: CollectionFilter): boolean => {
  switch (filter.field) {
    case 'genre':
      return Array.isArray(filter.value) && filter.value.length > 0;
    case 'year':
      if (filter.operator === 'between') {
        return (
          Array.isArray(filter.value) &&
          filter.value.length === 2 &&
          typeof filter.value[0] === 'number' &&
          typeof filter.value[1] === 'number' &&
          filter.value[0] <= filter.value[1]
        );
      }
      return (
        typeof filter.value === 'number' &&
        filter.value > 1800 &&
        filter.value <= new Date().getFullYear() + 5
      );
    case 'rating':
      if (filter.operator === 'between') {
        return (
          Array.isArray(filter.value) &&
          filter.value.length === 2 &&
          typeof filter.value[0] === 'number' &&
          typeof filter.value[1] === 'number' &&
          filter.value[0] >= 0 &&
          filter.value[0] <= 10 &&
          filter.value[1] >= 0 &&
          filter.value[1] <= 10 &&
          filter.value[0] <= filter.value[1]
        );
      }
      return (
        typeof filter.value === 'number' &&
        filter.value >= 0 &&
        filter.value <= 10
      );
    case 'availability':
      return Array.isArray(filter.value) && filter.value.length > 0;
    case 'content_type':
      return ['movie', 'show', 'season', 'episode'].includes(
        filter.value as string
      );
    case 'resolution':
      return ['4K', '1080p', '720p', '480p', 'SD'].includes(
        filter.value as string
      );
    default:
      return false;
  }
};

// Filter serialization for Kometa config
export const serializeFilterToKometa = (
  filter: CollectionFilter
): Record<string, unknown> => {
  const kometaFilter: Record<string, unknown> = {};

  switch (filter.field) {
    case 'genre':
      kometaFilter.genre = filter.value;
      break;
    case 'year':
      if (filter.operator === 'equals') {
        kometaFilter.year = filter.value;
      } else if (filter.operator === 'greater_than') {
        kometaFilter.year = { gte: filter.value };
      } else if (filter.operator === 'less_than') {
        kometaFilter.year = { lte: filter.value };
      } else if (filter.operator === 'between' && Array.isArray(filter.value)) {
        kometaFilter.year = { gte: filter.value[0], lte: filter.value[1] };
      }
      break;
    case 'rating':
      if (filter.operator === 'equals') {
        kometaFilter.rating = filter.value;
      } else if (filter.operator === 'greater_than') {
        kometaFilter.rating = { gte: filter.value };
      } else if (filter.operator === 'less_than') {
        kometaFilter.rating = { lte: filter.value };
      } else if (filter.operator === 'between' && Array.isArray(filter.value)) {
        kometaFilter.rating = { gte: filter.value[0], lte: filter.value[1] };
      }
      break;
    case 'availability':
      kometaFilter.streaming = filter.value;
      break;
    case 'content_type':
      kometaFilter.type = filter.value;
      break;
    case 'resolution':
      kometaFilter.resolution = filter.value;
      break;
  }

  return kometaFilter;
};
