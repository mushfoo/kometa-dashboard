import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormInput } from '@/components/forms/FormInput';
import { FormTextarea } from '@/components/forms/FormTextarea';
import { FormSelect } from '@/components/forms/FormSelect';
import { Info, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { FilterBuilder } from '@/components/filters';
import { useFilterStore } from '@/stores/filterStore';
import { serializeFilterGroupToKometa } from '@/types/filters';
import {
  collectionPreviewService,
  PreviewResult,
} from '@/lib/CollectionPreviewService';

// Collection schema based on Kometa's collection structure
const collectionSchema = z.object({
  name: z.string().min(1, 'Collection name is required'),
  description: z.string().optional(),
  poster: z.string().url().optional().or(z.literal('')),
  type: z.enum(['smart', 'manual']),
  sort_order: z
    .enum([
      'alpha',
      'release',
      'critic_rating',
      'audience_rating',
      'added',
      'random',
    ])
    .optional(),
  visible_library: z.boolean().optional(),
  visible_home: z.boolean().optional(),
  visible_shared: z.boolean().optional(),
  collection_mode: z.enum(['default', 'hide', 'hide_items']).optional(),
});

type CollectionFormData = z.infer<typeof collectionSchema>;

interface CollectionBuilderProps {
  onSave?: (collection: CollectionFormData) => void;
  initialData?: Partial<CollectionFormData>;
}

export function CollectionBuilder({
  onSave,
  initialData,
}: CollectionBuilderProps) {
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(
    null
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const { activeFilters, setActiveFilters, presets, savePreset, loadPreset } =
    useFilterStore();

  const form = useForm<CollectionFormData>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: '',
      description: '',
      poster: '',
      type: 'smart',
      sort_order: 'alpha',
      visible_library: true,
      visible_home: false,
      visible_shared: false,
      collection_mode: 'default',
      ...initialData,
    },
  });

  const watchType = form.watch('type');

  const handleSubmit = (data: CollectionFormData) => {
    // If it's a smart collection, include the filters
    const collectionData = { ...data };
    if (data.type === 'smart' && activeFilters.filters.length > 0) {
      // Serialize entire filter group for Kometa format
      const kometaFilters = serializeFilterGroupToKometa(activeFilters);

      // Add filters to collection data (this would be properly structured for Kometa)
      (collectionData as any).filters = kometaFilters;
    }
    onSave?.(collectionData);
  };

  const handlePreview = useCallback(async (): Promise<void> => {
    if (activeFilters.filters.length === 0) {
      setPreviewError('Please add at least one filter to generate a preview');
      return;
    }

    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      const result = await collectionPreviewService.generatePreview(
        activeFilters,
        {
          max_items: 20,
          include_external: true,
          confidence_threshold: 60,
        }
      );
      setPreviewResult(result);
    } catch (error) {
      setPreviewError('Failed to generate preview. Please try again.');
      console.error('Preview error:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [activeFilters]);

  // Auto-update preview when filters change
  useEffect(() => {
    if (watchType === 'smart' && activeFilters.filters.length > 0) {
      const timer = setTimeout(() => {
        handlePreview();
      }, 1000); // Debounce for 1 second

      return () => clearTimeout(timer);
    } else {
      setPreviewResult(null);
    }
  }, [activeFilters, watchType, handlePreview]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Create New Collection</CardTitle>
            <CardDescription>
              Build a collection to organize your media library
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>

                <FormInput
                  form={form}
                  name="name"
                  label="Collection Name"
                  placeholder="My Awesome Collection"
                  required
                />

                <FormTextarea
                  form={form}
                  name="description"
                  label="Description"
                  placeholder="Describe what this collection contains..."
                  rows={3}
                />

                <FormInput
                  form={form}
                  name="poster"
                  label="Poster URL"
                  placeholder="https://example.com/poster.jpg"
                  type="url"
                />
              </div>

              {/* Collection Type */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Collection Type</h3>

                <Tabs
                  value={watchType}
                  onValueChange={(value) =>
                    form.setValue('type', value as 'smart' | 'manual')
                  }
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="smart">Smart Collection</TabsTrigger>
                    <TabsTrigger value="manual">Manual Collection</TabsTrigger>
                  </TabsList>
                  <TabsContent value="smart" className="mt-4 space-y-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Smart collections automatically include items based on
                        filters you define. Items will be added or removed
                        automatically as your library changes.
                      </AlertDescription>
                    </Alert>

                    <div className="mt-6">
                      <h4 className="text-md font-semibold mb-4">
                        Collection Filters
                      </h4>
                      <FilterBuilder
                        filters={activeFilters}
                        onChange={setActiveFilters}
                        presets={presets}
                        onSavePreset={(name, description) =>
                          savePreset(name, description)
                        }
                        onLoadPreset={(preset) => loadPreset(preset.id)}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="manual" className="mt-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Manual collections require you to explicitly add each
                        item. Items won&apos;t be added or removed
                        automatically.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Metadata Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Metadata Settings</h3>

                <FormSelect
                  form={form}
                  name="sort_order"
                  label="Sort Order"
                  options={[
                    { value: 'alpha', label: 'Alphabetical' },
                    { value: 'release', label: 'Release Date' },
                    { value: 'critic_rating', label: 'Critic Rating' },
                    { value: 'audience_rating', label: 'Audience Rating' },
                    { value: 'added', label: 'Date Added' },
                    { value: 'random', label: 'Random' },
                  ]}
                />

                <FormSelect
                  form={form}
                  name="collection_mode"
                  label="Collection Mode"
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'hide', label: 'Hide Collection' },
                    { value: 'hide_items', label: 'Hide Items in Collection' },
                  ]}
                />
              </div>

              {/* Visibility Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Visibility Settings</h3>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      {...form.register('visible_library')}
                      className="rounded border-gray-300"
                    />
                    <span>Visible in Library</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      {...form.register('visible_home')}
                      className="rounded border-gray-300"
                    />
                    <span>Visible on Home Screen</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      {...form.register('visible_shared')}
                      className="rounded border-gray-300"
                    />
                    <span>Visible to Shared Users</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit">Create Collection</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                >
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Preview Panel */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Collection Preview</CardTitle>
            <CardDescription>
              See how your collection will appear
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
              {form.watch('poster') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.watch('poster')}
                  alt="Collection poster"
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => {
                    e.currentTarget.src = '';
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-gray-400">No poster</span>
              )}
            </div>

            <div>
              <h4 className="font-semibold">
                {form.watch('name') || 'Collection Name'}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {form.watch('description') || 'No description provided'}
              </p>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                <span className="font-medium capitalize">
                  {form.watch('type')}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600 dark:text-gray-400">Sort:</span>
                <span className="font-medium">
                  {form
                    .watch('sort_order')
                    ?.replace('_', ' ')
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              </div>

              {form.watch('type') === 'smart' &&
                activeFilters.filters.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Active Filters ({activeFilters.filters.length}):
                    </div>
                    <div className="text-xs space-y-1">
                      {activeFilters.filters.map((filter: any, idx: number) => (
                        <div key={idx} className="text-gray-500">
                          • {filter.field}:{' '}
                          {Array.isArray(filter.value)
                            ? filter.value.join(', ')
                            : filter.value}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Preview Results */}
            {form.watch('type') === 'smart' && (
              <div className="pt-4 border-t">
                {isLoadingPreview && (
                  <div className="text-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Generating preview...
                    </div>
                  </div>
                )}

                {previewError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div className="text-sm text-red-700 dark:text-red-400">
                      {previewError}
                    </div>
                  </div>
                )}

                {previewResult && !isLoadingPreview && (
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {previewResult.total_count}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Total matches
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <div className="font-medium text-green-700 dark:text-green-400">
                          {previewResult.library_matches}
                        </div>
                        <div className="text-green-600 dark:text-green-500">
                          In Library
                        </div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <div className="font-medium text-blue-700 dark:text-blue-400">
                          {previewResult.external_matches}
                        </div>
                        <div className="text-blue-600 dark:text-blue-500">
                          External
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">
                          {previewResult.confidence_score}% Confidence
                        </span>
                      </div>
                    </div>

                    {previewResult.items.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium mb-2">
                          Sample Items:
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {previewResult.items.slice(0, 5).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  item.in_library
                                    ? 'bg-green-500'
                                    : 'bg-blue-500'
                                }`}
                              />
                              <span className="truncate">
                                {item.title} {item.year && `(${item.year})`}
                              </span>
                            </div>
                          ))}
                          {previewResult.items.length > 5 && (
                            <div className="text-xs text-gray-500 text-center">
                              +{previewResult.items.length - 5} more items
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handlePreview}
              variant="outline"
              className="w-full"
              type="button"
              disabled={
                isLoadingPreview ||
                form.watch('type') !== 'smart' ||
                activeFilters.filters.length === 0
              }
            >
              {isLoadingPreview ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Update Preview'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
