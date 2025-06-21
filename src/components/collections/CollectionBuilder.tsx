import React, { useState } from 'react';
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
import { Info } from 'lucide-react';

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
  const [previewCount, setPreviewCount] = useState<number | null>(null);

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
    onSave?.(data);
  };

  const handlePreview = () => {
    // In a real implementation, this would query the Plex server
    // For now, we'll simulate with a random count
    setPreviewCount(Math.floor(Math.random() * 200) + 10);
  };

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
                  <TabsContent value="smart" className="mt-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Smart collections automatically include items based on
                        filters you define. Items will be added or removed
                        automatically as your library changes.
                      </AlertDescription>
                    </Alert>
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
            </div>

            {previewCount !== null && (
              <div className="pt-4 border-t">
                <div className="text-center">
                  <div className="text-3xl font-bold">{previewCount}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Estimated items
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handlePreview}
              variant="outline"
              className="w-full"
              type="button"
            >
              Update Preview
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
