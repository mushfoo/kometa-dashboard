/**
 * Filter system types for the Collection Builder
 */

export type FilterOperator = 'AND' | 'OR';
export type RuleOperator = 'include' | 'exclude';
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
  ruleOperator?: RuleOperator; // New: include/exclude behavior
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

export interface DateAddedFilter extends BaseFilter {
  field: 'date_added';
  operator: 'equals' | 'greater_than' | 'less_than' | 'between';
  value: string | [string, string]; // ISO date strings
}

export interface DateReleasedFilter extends BaseFilter {
  field: 'date_released';
  operator: 'equals' | 'greater_than' | 'less_than' | 'between';
  value: string | [string, string]; // ISO date strings
}

export interface DirectorFilter extends BaseFilter {
  field: 'director';
  operator: 'equals' | 'contains';
  value: string[];
}

export interface ActorFilter extends BaseFilter {
  field: 'actor';
  operator: 'equals' | 'contains';
  value: string[];
}

export interface StudioFilter extends BaseFilter {
  field: 'studio';
  operator: 'equals' | 'contains';
  value: string[];
}

export type CollectionFilter =
  | GenreFilter
  | YearFilter
  | RatingFilter
  | AvailabilityFilter
  | ContentTypeFilter
  | ResolutionFilter
  | DateAddedFilter
  | DateReleasedFilter
  | DirectorFilter
  | ActorFilter
  | StudioFilter;

export interface FilterGroup {
  id: string;
  operator: FilterOperator;
  filters: (CollectionFilter | FilterGroup)[];
  label?: string; // Human-readable label for the group
  isNested?: boolean; // Whether this group is nested inside another
  parentId?: string; // ID of parent group (for nested groups)
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
    case 'date_added':
    case 'date_released':
      if (filter.operator === 'between') {
        return (
          Array.isArray(filter.value) &&
          filter.value.length === 2 &&
          typeof filter.value[0] === 'string' &&
          typeof filter.value[1] === 'string' &&
          new Date(filter.value[0]) <= new Date(filter.value[1])
        );
      }
      return (
        typeof filter.value === 'string' && !isNaN(Date.parse(filter.value))
      );
    case 'director':
    case 'actor':
    case 'studio':
      return Array.isArray(filter.value) && filter.value.length > 0;
    default:
      return false;
  }
};

// Validate entire filter group for logical consistency
export const validateFilterGroup = (group: FilterGroup): boolean => {
  if (group.filters.length === 0) return false;

  // Check all filters in group are valid
  for (const filter of group.filters) {
    if (isFilterGroup(filter)) {
      if (!validateFilterGroup(filter)) return false;
    } else {
      if (!validateFilter(filter as CollectionFilter)) return false;
    }
  }

  // Check for logical conflicts (e.g., include AND exclude same genre)
  const conflicts = detectLogicalConflicts(group);
  return conflicts.length === 0;
};

// Detect logical conflicts in filter groups
export const detectLogicalConflicts = (group: FilterGroup): string[] => {
  const conflicts: string[] = [];
  const includeFilters: CollectionFilter[] = [];
  const excludeFilters: CollectionFilter[] = [];

  // Separate include/exclude filters
  for (const filter of group.filters) {
    if (!isFilterGroup(filter)) {
      const f = filter as CollectionFilter;
      if (f.ruleOperator === 'exclude') {
        excludeFilters.push(f);
      } else {
        includeFilters.push(f);
      }
    }
  }

  // Check for same field with conflicting values
  for (const includeFilter of includeFilters) {
    for (const excludeFilter of excludeFilters) {
      if (includeFilter.field === excludeFilter.field) {
        // Check if there's overlap in values
        if (hasValueOverlap(includeFilter, excludeFilter)) {
          conflicts.push(
            `Conflict: Including and excluding the same ${includeFilter.field} values`
          );
        }
      }
    }
  }

  return conflicts;
};

// Check if two filters have overlapping values
const hasValueOverlap = (
  filter1: CollectionFilter,
  filter2: CollectionFilter
): boolean => {
  if (Array.isArray(filter1.value) && Array.isArray(filter2.value)) {
    return filter1.value.some((v) => (filter2.value as unknown[]).includes(v));
  }
  return filter1.value === filter2.value;
};

// Filter serialization for Kometa config
export const serializeFilterToKometa = (
  filter: CollectionFilter
): Record<string, unknown> => {
  const kometaFilter: Record<string, unknown> = {};
  const isExclude = filter.ruleOperator === 'exclude';

  switch (filter.field) {
    case 'genre':
      kometaFilter[isExclude ? 'genre.not' : 'genre'] = filter.value;
      break;
    case 'year':
      const yearField = isExclude ? 'year.not' : 'year';
      if (filter.operator === 'equals') {
        kometaFilter[yearField] = filter.value;
      } else if (filter.operator === 'greater_than') {
        kometaFilter[`${yearField}.gte`] = filter.value;
      } else if (filter.operator === 'less_than') {
        kometaFilter[`${yearField}.lte`] = filter.value;
      } else if (filter.operator === 'between' && Array.isArray(filter.value)) {
        kometaFilter[`${yearField}.gte`] = filter.value[0];
        kometaFilter[`${yearField}.lte`] = filter.value[1];
      }
      break;
    case 'rating':
      const ratingField = isExclude ? 'user_rating.not' : 'user_rating';
      if (filter.operator === 'equals') {
        kometaFilter[ratingField] = filter.value;
      } else if (filter.operator === 'greater_than') {
        kometaFilter[`${ratingField}.gte`] = filter.value;
      } else if (filter.operator === 'less_than') {
        kometaFilter[`${ratingField}.lte`] = filter.value;
      } else if (filter.operator === 'between' && Array.isArray(filter.value)) {
        kometaFilter[`${ratingField}.gte`] = filter.value[0];
        kometaFilter[`${ratingField}.lte`] = filter.value[1];
      }
      break;
    case 'availability':
      kometaFilter[isExclude ? 'streaming.not' : 'streaming'] = filter.value;
      break;
    case 'content_type':
      kometaFilter[isExclude ? 'type.not' : 'type'] = filter.value;
      break;
    case 'resolution':
      kometaFilter[isExclude ? 'resolution.not' : 'resolution'] = filter.value;
      break;
    case 'date_added':
      const dateAddedField = isExclude ? 'added.not' : 'added';
      if (filter.operator === 'equals') {
        kometaFilter[dateAddedField] = filter.value;
      } else if (filter.operator === 'greater_than') {
        kometaFilter[`${dateAddedField}.gte`] = filter.value;
      } else if (filter.operator === 'less_than') {
        kometaFilter[`${dateAddedField}.lte`] = filter.value;
      } else if (filter.operator === 'between' && Array.isArray(filter.value)) {
        kometaFilter[`${dateAddedField}.gte`] = filter.value[0];
        kometaFilter[`${dateAddedField}.lte`] = filter.value[1];
      }
      break;
    case 'date_released':
      const dateReleasedField = isExclude ? 'release.not' : 'release';
      if (filter.operator === 'equals') {
        kometaFilter[dateReleasedField] = filter.value;
      } else if (filter.operator === 'greater_than') {
        kometaFilter[`${dateReleasedField}.gte`] = filter.value;
      } else if (filter.operator === 'less_than') {
        kometaFilter[`${dateReleasedField}.lte`] = filter.value;
      } else if (filter.operator === 'between' && Array.isArray(filter.value)) {
        kometaFilter[`${dateReleasedField}.gte`] = filter.value[0];
        kometaFilter[`${dateReleasedField}.lte`] = filter.value[1];
      }
      break;
    case 'director':
      kometaFilter[isExclude ? 'director.not' : 'director'] = filter.value;
      break;
    case 'actor':
      kometaFilter[isExclude ? 'actor.not' : 'actor'] = filter.value;
      break;
    case 'studio':
      kometaFilter[isExclude ? 'studio.not' : 'studio'] = filter.value;
      break;
  }

  return kometaFilter;
};

// Serialize entire filter group to Kometa format
export const serializeFilterGroupToKometa = (
  group: FilterGroup
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  if (group.filters.length === 0) return result;

  // Flatten all filters to direct properties
  const flattenFilters = (
    filters: (CollectionFilter | FilterGroup)[]
  ): Record<string, unknown> => {
    const flattened: Record<string, unknown> = {};

    for (const filter of filters) {
      if (isFilterGroup(filter)) {
        // Recursively flatten nested groups
        const nested = flattenFilters(filter.filters);
        Object.assign(flattened, nested);
      } else {
        // Convert single filter to direct properties
        const serialized = serializeFilterToKometa(filter as CollectionFilter);
        Object.assign(flattened, serialized);
      }
    }

    return flattened;
  };

  // For AND operations, we can directly flatten all filters
  // For OR operations, we need to use Kometa's any: structure only when necessary
  if (group.operator === 'AND' || group.filters.length === 1) {
    return flattenFilters(group.filters);
  } else {
    // OR with multiple filters - use any: structure
    const serializedFilters = group.filters.map((filter) => {
      if (isFilterGroup(filter)) {
        return serializeFilterGroupToKometa(filter);
      } else {
        return serializeFilterToKometa(filter as CollectionFilter);
      }
    });

    result.any = serializedFilters;
  }

  return result;
};
