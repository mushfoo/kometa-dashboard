'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Library,
  Settings,
  Clock,
  Save,
  RotateCcw,
  Package,
  Info,
} from 'lucide-react';
import {
  librarySettingsFormSchema,
  type LibrarySettingsFormSchema,
} from '@/lib/schemas/forms';

export default function LibrarySettingsPage() {
  const [activeTab, setActiveTab] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: libraries, isLoading } = useQuery({
    queryKey: ['libraries'],
    queryFn: async () => {
      const response = await fetch('/api/config/libraries');
      if (!response.ok) throw new Error('Failed to load libraries');
      return response.json();
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    watch,
    reset,
    setValue,
  } = useForm<LibrarySettingsFormSchema>({
    resolver: zodResolver(librarySettingsFormSchema),
    defaultValues: {
      libraries: [],
      settings: {
        scan_interval: 24,
        scanner_threads: 2,
        collection_refresh_interval: 168,
        delete_unmanaged_collections: false,
        delete_unmanaged_assets: false,
      },
    },
  });

  const { fields } = useFieldArray({
    control,
    name: 'libraries',
  });

  // Update form when data loads
  useQuery({
    queryKey: ['library-settings', libraries],
    queryFn: async () => {
      if (libraries && libraries.length > 0) {
        reset({
          libraries: libraries,
          settings: {
            scan_interval: libraries[0]?.scan_interval || 24,
            scanner_threads: libraries[0]?.scanner_threads || 2,
            collection_refresh_interval:
              libraries[0]?.collection_refresh_interval || 168,
            delete_unmanaged_collections:
              libraries[0]?.delete_unmanaged_collections || false,
            delete_unmanaged_assets:
              libraries[0]?.delete_unmanaged_assets || false,
          },
        });
        setActiveTab(libraries[0]?.library_name || '');
      }
      return libraries;
    },
    enabled: !!libraries,
  });

  const saveLibrariesMutation = useMutation({
    mutationFn: async (data: LibrarySettingsFormSchema) => {
      const response = await fetch('/api/config/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save library settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });

  const applyToAllMutation = useMutation({
    mutationFn: async (settings: LibrarySettingsFormSchema['settings']) => {
      const updatedLibraries = fields.map((field, index) => ({
        ...watch(`libraries.${index}`),
        ...settings,
      }));

      const data: LibrarySettingsFormSchema = {
        libraries: updatedLibraries,
        settings,
      };

      return saveLibrariesMutation.mutateAsync(data);
    },
  });

  const onSubmit = async (data: LibrarySettingsFormSchema) => {
    await saveLibrariesMutation.mutateAsync(data);
  };

  const handleApplyToAll = () => {
    const settings = watch('settings');
    applyToAllMutation.mutate(settings);
  };

  const getLibraryTypeIcon = (type: string) => {
    switch (type) {
      case 'movie':
        return '🎬';
      case 'show':
        return '📺';
      case 'music':
        return '🎵';
      default:
        return '📁';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!libraries || libraries.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Library Settings
          </h1>
          <p className="text-muted-foreground">
            Configure settings for your Plex libraries.
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No libraries found. Please configure your Plex connection first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Library Settings</h1>
        <p className="text-muted-foreground">
          Configure settings for each of your Plex libraries.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Global Settings */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Global Settings</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scan_interval">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Scan Interval (hours)
                </Label>
                <Input
                  id="scan_interval"
                  type="number"
                  min="1"
                  max="168"
                  {...register('settings.scan_interval', {
                    valueAsNumber: true,
                  })}
                />
                {errors.settings?.scan_interval && (
                  <p className="text-sm text-destructive">
                    {errors.settings.scan_interval.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="scanner_threads">Scanner Threads</Label>
                <Input
                  id="scanner_threads"
                  type="number"
                  min="1"
                  max="10"
                  {...register('settings.scanner_threads', {
                    valueAsNumber: true,
                  })}
                />
                {errors.settings?.scanner_threads && (
                  <p className="text-sm text-destructive">
                    {errors.settings.scanner_threads.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="collection_refresh_interval">
                  Collection Refresh Interval (hours)
                </Label>
                <Input
                  id="collection_refresh_interval"
                  type="number"
                  min="1"
                  max="720"
                  {...register('settings.collection_refresh_interval', {
                    valueAsNumber: true,
                  })}
                />
                {errors.settings?.collection_refresh_interval && (
                  <p className="text-sm text-destructive">
                    {errors.settings.collection_refresh_interval.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="delete_unmanaged_collections">
                    Delete Unmanaged Collections
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Remove collections not managed by Kometa
                  </p>
                </div>
                <Switch
                  id="delete_unmanaged_collections"
                  {...register('settings.delete_unmanaged_collections')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="delete_unmanaged_assets">
                    Delete Unmanaged Assets
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Remove posters and backgrounds not managed by Kometa
                  </p>
                </div>
                <Switch
                  id="delete_unmanaged_assets"
                  {...register('settings.delete_unmanaged_assets')}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleApplyToAll}
                disabled={applyToAllMutation.isPending}
              >
                {applyToAllMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Apply to All Libraries
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Library-specific Settings */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Library className="h-5 w-5" />
              <h2 className="text-lg font-semibold">
                Library-Specific Settings
              </h2>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList
                className="grid w-full"
                style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr)` }}
              >
                {fields.map((field) => (
                  <TabsTrigger key={field.id} value={field.library_name}>
                    <span className="mr-1">
                      {getLibraryTypeIcon(field.type)}
                    </span>
                    {field.library_name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {fields.map((field, index) => (
                <TabsContent
                  key={field.id}
                  value={field.library_name}
                  className="space-y-4"
                >
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label>Library Type</Label>
                      <Select
                        value={watch(`libraries.${index}.type`)}
                        onValueChange={(value) =>
                          setValue(`libraries.${index}.type`, value as any)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="movie">Movies</SelectItem>
                          <SelectItem value="show">TV Shows</SelectItem>
                          <SelectItem value="music">Music</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium">Operations</h3>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor={`assets_for_all_${index}`}>
                              Assets for All
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Download posters and backgrounds for all items
                            </p>
                          </div>
                          <Switch
                            id={`assets_for_all_${index}`}
                            {...register(
                              `libraries.${index}.operations.assets_for_all`
                            )}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor={`delete_collections_${index}`}>
                              Delete Collections
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Delete collections during maintenance
                            </p>
                          </div>
                          <Switch
                            id={`delete_collections_${index}`}
                            {...register(
                              `libraries.${index}.operations.delete_collections`
                            )}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor={`mass_critic_rating_${index}`}>
                              Mass Critic Rating Update
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Update critic ratings from external sources
                            </p>
                          </div>
                          <Switch
                            id={`mass_critic_rating_${index}`}
                            {...register(
                              `libraries.${index}.operations.mass_critic_rating_update`
                            )}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor={`split_duplicates_${index}`}>
                              Split Duplicates
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Split merged duplicate items
                            </p>
                          </div>
                          <Switch
                            id={`split_duplicates_${index}`}
                            {...register(
                              `libraries.${index}.operations.split_duplicates`
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`scan_interval_${index}`}>
                        Library Scan Interval (hours)
                      </Label>
                      <Input
                        id={`scan_interval_${index}`}
                        type="number"
                        min="1"
                        max="168"
                        placeholder="Use global setting"
                        {...register(`libraries.${index}.scan_interval`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={isSubmitting || saveLibrariesMutation.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || saveLibrariesMutation.isPending}
          >
            {saveLibrariesMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
