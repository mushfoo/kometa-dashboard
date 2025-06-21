import React, { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { MultiSelectFilter } from './MultiSelectFilter';
import { RangeSliderFilter } from './RangeSliderFilter';
import { SelectFilter } from './SelectFilter';
import {
  CollectionFilter,
  FilterGroup,
  FilterOperator,
  FilterPreset,
  GenreFilter,
  YearFilter,
  RatingFilter,
  AvailabilityFilter,
  ContentTypeFilter,
  ResolutionFilter,
  validateFilter,
} from '@/types/filters';

interface FilterBuilderProps {
  filters: FilterGroup;
  onChange: (filters: FilterGroup) => void;
  presets?: FilterPreset[];
  onSavePreset?: (name: string, description?: string) => void;
  onLoadPreset?: (preset: FilterPreset) => void;
  className?: string;
}

// Mock data - in a real app, these would come from APIs
const GENRES = [
  { value: 'action', label: 'Action' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'animation', label: 'Animation' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'crime', label: 'Crime' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'drama', label: 'Drama' },
  { value: 'family', label: 'Family' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'horror', label: 'Horror' },
  { value: 'mystery', label: 'Mystery' },
  { value: 'romance', label: 'Romance' },
  { value: 'sci-fi', label: 'Science Fiction' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'war', label: 'War' },
  { value: 'western', label: 'Western' },
];

const PLATFORMS = [
  { value: 'netflix', label: 'Netflix' },
  { value: 'hulu', label: 'Hulu' },
  { value: 'disney+', label: 'Disney+' },
  { value: 'amazon', label: 'Prime Video' },
  { value: 'hbo', label: 'HBO Max' },
  { value: 'apple', label: 'Apple TV+' },
  { value: 'paramount', label: 'Paramount+' },
  { value: 'peacock', label: 'Peacock' },
];

const CONTENT_TYPES = [
  { value: 'movie', label: 'Movies' },
  { value: 'show', label: 'TV Shows' },
  { value: 'season', label: 'Seasons' },
  { value: 'episode', label: 'Episodes' },
];

const RESOLUTIONS = [
  { value: '4K', label: '4K' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: 'SD', label: 'SD' },
];

export function FilterBuilder({
  filters,
  onChange,
  presets = [],
  onSavePreset,
  onLoadPreset,
  className = '',
}: FilterBuilderProps) {
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');

  const createNewFilter = (
    type: CollectionFilter['field']
  ): CollectionFilter => {
    const id = `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const baseFilter = { id, enabled: true };

    switch (type) {
      case 'genre':
        return {
          ...baseFilter,
          field: 'genre',
          operator: 'contains',
          value: [],
        } as GenreFilter;
      case 'year':
        return {
          ...baseFilter,
          field: 'year',
          operator: 'equals',
          value: new Date().getFullYear(),
        } as YearFilter;
      case 'rating':
        return {
          ...baseFilter,
          field: 'rating',
          operator: 'greater_than',
          value: 7,
        } as RatingFilter;
      case 'availability':
        return {
          ...baseFilter,
          field: 'availability',
          operator: 'equals',
          value: [],
        } as AvailabilityFilter;
      case 'content_type':
        return {
          ...baseFilter,
          field: 'content_type',
          operator: 'equals',
          value: 'movie',
        } as ContentTypeFilter;
      case 'resolution':
        return {
          ...baseFilter,
          field: 'resolution',
          operator: 'equals',
          value: '1080p',
        } as ResolutionFilter;
      default:
        throw new Error(`Unknown filter type: ${type}`);
    }
  };

  const addFilter = (type: CollectionFilter['field']) => {
    const newFilter = createNewFilter(type);
    onChange({
      ...filters,
      filters: [...filters.filters, newFilter],
    });
  };

  const updateFilter = (index: number, updatedFilter: CollectionFilter) => {
    const newFilters = [...filters.filters];
    newFilters[index] = updatedFilter;
    onChange({ ...filters, filters: newFilters });
  };

  const removeFilter = (index: number) => {
    onChange({
      ...filters,
      filters: filters.filters.filter((_, i) => i !== index),
    });
  };

  const updateOperator = (operator: FilterOperator) => {
    onChange({ ...filters, operator });
  };

  const handleSavePreset = () => {
    if (presetName && onSavePreset) {
      onSavePreset(presetName, presetDescription);
      setShowPresetDialog(false);
      setPresetName('');
      setPresetDescription('');
    }
  };

  const renderFilter = (filter: CollectionFilter, index: number) => {
    const isValid = validateFilter(filter);

    return (
      <div
        key={filter.id}
        className={`p-4 bg-zinc-800/50 rounded-lg border ${
          isValid ? 'border-zinc-700' : 'border-red-500/50'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <h4 className="text-sm font-medium text-zinc-300 capitalize">
            {filter.field.replace('_', ' ')} Filter
          </h4>
          <button
            type="button"
            onClick={() => removeFilter(index)}
            className="text-zinc-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {filter.field === 'genre' && (
          <MultiSelectFilter
            label="Genres"
            options={GENRES}
            value={(filter as GenreFilter).value}
            onChange={(value) =>
              updateFilter(index, { ...filter, value } as GenreFilter)
            }
          />
        )}

        {filter.field === 'year' && (
          <RangeSliderFilter
            label="Year"
            min={1900}
            max={new Date().getFullYear() + 5}
            value={(filter as YearFilter).value}
            onChange={(value) =>
              updateFilter(index, { ...filter, value } as YearFilter)
            }
            operator={(filter as YearFilter).operator as any}
            onOperatorChange={(operator) =>
              updateFilter(index, { ...filter, operator } as YearFilter)
            }
          />
        )}

        {filter.field === 'rating' && (
          <RangeSliderFilter
            label="Rating"
            min={0}
            max={10}
            step={0.1}
            value={(filter as RatingFilter).value}
            onChange={(value) =>
              updateFilter(index, { ...filter, value } as RatingFilter)
            }
            operator={(filter as RatingFilter).operator as any}
            onOperatorChange={(operator) =>
              updateFilter(index, { ...filter, operator } as RatingFilter)
            }
            formatValue={(v) => v.toFixed(1)}
          />
        )}

        {filter.field === 'availability' && (
          <MultiSelectFilter
            label="Available On"
            options={PLATFORMS}
            value={(filter as AvailabilityFilter).value}
            onChange={(value) =>
              updateFilter(index, { ...filter, value } as AvailabilityFilter)
            }
          />
        )}

        {filter.field === 'content_type' && (
          <SelectFilter
            label="Content Type"
            options={CONTENT_TYPES}
            value={(filter as ContentTypeFilter).value}
            onChange={(value) =>
              updateFilter(index, {
                ...filter,
                value: value as any,
              } as ContentTypeFilter)
            }
          />
        )}

        {filter.field === 'resolution' && (
          <SelectFilter
            label="Resolution"
            options={RESOLUTIONS}
            value={(filter as ResolutionFilter).value}
            onChange={(value) =>
              updateFilter(index, {
                ...filter,
                value: value as any,
              } as ResolutionFilter)
            }
          />
        )}

        {!isValid && (
          <p className="mt-2 text-sm text-red-400">
            Please complete this filter configuration
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filter Operator Selection */}
      {filters.filters.length > 1 && (
        <div className="flex items-center gap-4 p-4 bg-zinc-800/30 rounded-lg">
          <span className="text-sm text-zinc-400">Combine filters using:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateOperator('AND')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                filters.operator === 'AND'
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              AND (all must match)
            </button>
            <button
              type="button"
              onClick={() => updateOperator('OR')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                filters.operator === 'OR'
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              OR (any can match)
            </button>
          </div>
        </div>
      )}

      {/* Active Filters */}
      <div className="space-y-3">
        {filters.filters.map((filter, index) =>
          renderFilter(filter as CollectionFilter, index)
        )}
      </div>

      {/* Add Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => addFilter('genre')}
          className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Genre Filter
        </button>
        <button
          type="button"
          onClick={() => addFilter('year')}
          className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Year Filter
        </button>
        <button
          type="button"
          onClick={() => addFilter('rating')}
          className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Rating Filter
        </button>
        <button
          type="button"
          onClick={() => addFilter('availability')}
          className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Availability Filter
        </button>
        <button
          type="button"
          onClick={() => addFilter('content_type')}
          className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Content Type Filter
        </button>
        <button
          type="button"
          onClick={() => addFilter('resolution')}
          className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Resolution Filter
        </button>
      </div>

      {/* Preset Management */}
      {(onSavePreset || (presets.length > 0 && onLoadPreset)) && (
        <div className="flex items-center gap-2 pt-4 border-t border-zinc-800">
          {onSavePreset && filters.filters.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPresetDialog(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm text-white transition-colors"
            >
              <Save className="w-4 h-4" />
              Save as Preset
            </button>
          )}

          {presets.length > 0 && onLoadPreset && (
            <select
              onChange={(e) => {
                const preset = presets.find((p) => p.id === e.target.value);
                if (preset) onLoadPreset(preset);
              }}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm"
            >
              <option value="">Load Preset...</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Preset Save Dialog */}
      {showPresetDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Save Filter Preset</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Preset Name
                </label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., Action Movies 2020+"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                  placeholder="Describe what this preset filters for..."
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetName}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
              >
                Save Preset
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPresetDialog(false);
                  setPresetName('');
                  setPresetDescription('');
                }}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
