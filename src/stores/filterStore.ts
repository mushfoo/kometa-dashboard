import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  FilterState,
  FilterGroup,
  FilterPreset,
  CollectionFilter,
} from '@/types/filters';

interface FilterStore extends FilterState {
  // Actions
  setActiveFilters: (filters: FilterGroup) => void;
  addFilter: (filter: CollectionFilter) => void;
  updateFilter: (filterId: string, updates: Partial<CollectionFilter>) => void;
  removeFilter: (filterId: string) => void;
  clearFilters: () => void;

  // Preset actions
  savePreset: (name: string, description?: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  updatePreset: (presetId: string, updates: Partial<FilterPreset>) => void;

  // State helpers
  markClean: () => void;
  markDirty: () => void;
}

const defaultFilterGroup: FilterGroup = {
  id: 'root',
  operator: 'AND',
  filters: [],
};

export const useFilterStore = create<FilterStore>()(
  persist(
    (set, get) => ({
      activeFilters: defaultFilterGroup,
      presets: [],
      isDirty: false,

      setActiveFilters: (filters) =>
        set({ activeFilters: filters, isDirty: true }),

      addFilter: (filter) =>
        set((state) => ({
          activeFilters: {
            ...state.activeFilters,
            filters: [...state.activeFilters.filters, filter],
          },
          isDirty: true,
        })),

      updateFilter: (filterId, updates) =>
        set((state) => {
          const updateFilterRecursive = (group: FilterGroup): FilterGroup => {
            return {
              ...group,
              filters: group.filters.map((f) => {
                if ('filters' in f) {
                  return updateFilterRecursive(f as FilterGroup);
                }
                const filter = f as CollectionFilter;
                return filter.id === filterId
                  ? ({ ...filter, ...updates } as CollectionFilter)
                  : filter;
              }),
            };
          };

          return {
            activeFilters: updateFilterRecursive(state.activeFilters),
            isDirty: true,
          };
        }),

      removeFilter: (filterId) =>
        set((state) => {
          const removeFilterRecursive = (group: FilterGroup): FilterGroup => {
            return {
              ...group,
              filters: group.filters.filter((f) => {
                if ('filters' in f) {
                  const updated = removeFilterRecursive(f as FilterGroup);
                  return updated.filters.length > 0;
                }
                const filter = f as CollectionFilter;
                return filter.id !== filterId;
              }),
            };
          };

          return {
            activeFilters: removeFilterRecursive(state.activeFilters),
            isDirty: true,
          };
        }),

      clearFilters: () =>
        set({
          activeFilters: defaultFilterGroup,
          isDirty: false,
        }),

      savePreset: (name, description) =>
        set((state) => {
          const preset: FilterPreset = {
            id: `preset-${Date.now()}`,
            name,
            ...(description && { description }),
            filterGroup: JSON.parse(JSON.stringify(state.activeFilters)), // Deep clone
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            presets: [...state.presets, preset],
          };
        }),

      loadPreset: (presetId) =>
        set((state) => {
          const preset = state.presets.find((p) => p.id === presetId);
          if (preset) {
            return {
              activeFilters: JSON.parse(JSON.stringify(preset.filterGroup)), // Deep clone
              isDirty: false,
            };
          }
          return state;
        }),

      deletePreset: (presetId) =>
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== presetId),
        })),

      updatePreset: (presetId, updates) =>
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === presetId
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          ),
        })),

      markClean: () => set({ isDirty: false }),
      markDirty: () => set({ isDirty: true }),
    }),
    {
      name: 'kometa-filter-storage',
      partialize: (state) => ({
        presets: state.presets,
      }),
    }
  )
);
