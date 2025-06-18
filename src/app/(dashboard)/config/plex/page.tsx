'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Server, Library } from 'lucide-react';
import {
  plexConnectionFormSchema,
  type PlexConnectionForm,
} from '@/lib/schemas/forms';
import { Checkbox } from '@/components/ui/checkbox';

interface PlexLibrary {
  key: string;
  title: string;
  type: 'movie' | 'show' | 'music' | 'photo';
  location: string[];
  scanner: string;
  agent: string;
}

interface PlexConnectionTestResult {
  success: boolean;
  message: string;
  libraries?: PlexLibrary[];
}

export default function PlexConfigurationPage() {
  const [testResult, setTestResult] = useState<PlexConnectionTestResult | null>(
    null
  );
  const [selectedLibraries, setSelectedLibraries] = useState<Set<string>>(
    new Set()
  );
  const queryClient = useQueryClient();

  const { data: currentConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['plex-config'],
    queryFn: async () => {
      const response = await fetch('/api/config/plex');
      if (!response.ok) throw new Error('Failed to load Plex configuration');
      return response.json();
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<PlexConnectionForm>({
    resolver: zodResolver(plexConnectionFormSchema),
    defaultValues: currentConfig || {
      url: '',
      token: '',
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (data: PlexConnectionForm) => {
      const response = await fetch('/api/config/plex/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Connection test failed');
      }
      return response.json();
    },
    onSuccess: (data: PlexConnectionTestResult) => {
      setTestResult(data);
      if (data.libraries && currentConfig?.selectedLibraries) {
        setSelectedLibraries(new Set(currentConfig.selectedLibraries));
      }
    },
    onError: (error: Error) => {
      setTestResult({
        success: false,
        message: error.message,
      });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (
      data: PlexConnectionForm & { selectedLibraries: string[] }
    ) => {
      const response = await fetch('/api/config/plex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save configuration');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plex-config'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });

  const onSubmit = async (data: PlexConnectionForm) => {
    await saveConfigMutation.mutateAsync({
      ...data,
      selectedLibraries: Array.from(selectedLibraries),
    });
  };

  const handleTestConnection = () => {
    const formData = watch();
    testConnectionMutation.mutate(formData);
  };

  const toggleLibrary = (libraryKey: string) => {
    const newSelected = new Set(selectedLibraries);
    if (newSelected.has(libraryKey)) {
      newSelected.delete(libraryKey);
    } else {
      newSelected.add(libraryKey);
    }
    setSelectedLibraries(newSelected);
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Plex Configuration
        </h1>
        <p className="text-muted-foreground">
          Connect your Plex server to manage your media libraries with Kometa.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Server className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Server Connection</h2>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Plex Server URL</Label>
              <Input
                id="url"
                placeholder="http://localhost:32400"
                {...register('url')}
                aria-describedby="url-error"
              />
              {errors.url && (
                <p id="url-error" className="text-sm text-destructive">
                  {errors.url.message}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Enter your Plex server URL including the port (usually 32400)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="token">Plex Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Your Plex authentication token"
                {...register('token')}
                aria-describedby="token-error"
              />
              {errors.token && (
                <p id="token-error" className="text-sm text-destructive">
                  {errors.token.message}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Find your token at{' '}
                <a
                  href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Plex Support
                </a>
              </p>
            </div>

            <div className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={
                  testConnectionMutation.isPending ||
                  !watch('url') ||
                  !watch('token')
                }
              >
                {testConnectionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
            </div>

            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'}>
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5" />
                  )}
                  <AlertDescription>{testResult.message}</AlertDescription>
                </div>
              </Alert>
            )}
          </div>
        </Card>

        {testResult?.success && testResult.libraries && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Library className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Select Libraries</h2>
              </div>

              <p className="text-sm text-muted-foreground">
                Choose which libraries Kometa should manage:
              </p>

              <div className="space-y-3">
                {testResult.libraries.map((library) => (
                  <div
                    key={library.key}
                    className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={`library-${library.key}`}
                      checked={selectedLibraries.has(library.key)}
                      onCheckedChange={() => toggleLibrary(library.key)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <label
                        htmlFor={`library-${library.key}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {library.title}
                      </label>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Type: {library.type}</p>
                        <p>Scanner: {library.scanner}</p>
                        {library.location.length > 0 && (
                          <p>Location: {library.location[0]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              saveConfigMutation.isPending ||
              !testResult?.success ||
              selectedLibraries.size === 0
            }
          >
            {saveConfigMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
