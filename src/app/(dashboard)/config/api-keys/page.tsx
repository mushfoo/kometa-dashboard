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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Film,
  Tv,
  Database,
} from 'lucide-react';
import { apiKeysFormSchema, type ApiKeysFormSchema } from '@/lib/schemas/forms';

interface ApiKeyValidationResult {
  service: string;
  valid: boolean;
  message: string;
}

export default function ApiKeysConfigurationPage() {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validationResults, setValidationResults] = useState<
    Record<string, ApiKeyValidationResult>
  >({});
  const queryClient = useQueryClient();

  const { data: currentKeys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await fetch('/api/config/api-keys');
      if (!response.ok) throw new Error('Failed to load API keys');
      return response.json();
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<ApiKeysFormSchema>({
    resolver: zodResolver(apiKeysFormSchema),
    defaultValues: currentKeys || {
      tmdb: '',
      trakt: {
        client_id: '',
        client_secret: '',
        pin: '',
      },
      imdb: '',
      anidb: {
        client: '',
        version: '',
        language: 'en',
      },
    },
  });

  const validateKeyMutation = useMutation({
    mutationFn: async ({ service, data }: { service: string; data: any }) => {
      const response = await fetch(`/api/config/api-keys/validate/${service}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Validation failed');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      setValidationResults((prev) => ({
        ...prev,
        [variables.service]: data,
      }));
    },
    onError: (error: Error, variables) => {
      setValidationResults((prev) => ({
        ...prev,
        [variables.service]: {
          service: variables.service,
          valid: false,
          message: error.message,
        },
      }));
    },
  });

  const saveKeysMutation = useMutation({
    mutationFn: async (data: ApiKeysFormSchema) => {
      const response = await fetch('/api/config/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save API keys');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });

  const onSubmit = async (data: ApiKeysFormSchema) => {
    await saveKeysMutation.mutateAsync(data);
  };

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validateKey = (service: string) => {
    const formData = watch();
    let data: any;

    switch (service) {
      case 'tmdb':
        data = { api_key: formData.tmdb };
        break;
      case 'trakt':
        data = formData.trakt;
        break;
      case 'imdb':
        data = { api_key: formData.imdb };
        break;
      case 'anidb':
        data = formData.anidb;
        break;
    }

    validateKeyMutation.mutate({ service, data });
  };

  if (isLoading) {
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
          API Keys Configuration
        </h1>
        <p className="text-muted-foreground">
          Configure API keys for external services to enhance metadata and
          enable additional features.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="tmdb" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tmdb">TMDb</TabsTrigger>
            <TabsTrigger value="trakt">Trakt</TabsTrigger>
            <TabsTrigger value="imdb">IMDb</TabsTrigger>
            <TabsTrigger value="anidb">AniDB</TabsTrigger>
          </TabsList>

          <TabsContent value="tmdb">
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Film className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">
                    The Movie Database (TMDb)
                  </h2>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tmdb">API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="tmdb"
                        type={showKeys.tmdb ? 'text' : 'password'}
                        placeholder="Your TMDb API key"
                        {...register('tmdb')}
                        aria-describedby="tmdb-error"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => toggleShowKey('tmdb')}
                      >
                        {showKeys.tmdb ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => validateKey('tmdb')}
                      disabled={!watch('tmdb') || validateKeyMutation.isPending}
                    >
                      {validateKeyMutation.isPending &&
                      validateKeyMutation.variables?.service === 'tmdb' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Validate'
                      )}
                    </Button>
                  </div>
                  {errors.tmdb && (
                    <p id="tmdb-error" className="text-sm text-destructive">
                      {errors.tmdb.message}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Get your API key from{' '}
                    <a
                      href="https://www.themoviedb.org/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      TMDb Settings
                    </a>
                  </p>
                </div>

                {validationResults.tmdb && (
                  <Alert
                    variant={
                      validationResults.tmdb.valid ? 'default' : 'destructive'
                    }
                  >
                    <div className="flex items-start gap-2">
                      {validationResults.tmdb.valid ? (
                        <CheckCircle2 className="h-4 w-4 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 mt-0.5" />
                      )}
                      <AlertDescription>
                        {validationResults.tmdb.message}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="trakt">
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Tv className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Trakt</h2>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="trakt-client-id">Client ID</Label>
                    <div className="flex gap-2">
                      <Input
                        id="trakt-client-id"
                        type={showKeys['trakt-client-id'] ? 'text' : 'password'}
                        placeholder="Your Trakt Client ID"
                        {...register('trakt.client_id')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleShowKey('trakt-client-id')}
                      >
                        {showKeys['trakt-client-id'] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {errors.trakt?.client_id && (
                      <p className="text-sm text-destructive">
                        {errors.trakt.client_id.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trakt-client-secret">Client Secret</Label>
                    <div className="flex gap-2">
                      <Input
                        id="trakt-client-secret"
                        type={
                          showKeys['trakt-client-secret'] ? 'text' : 'password'
                        }
                        placeholder="Your Trakt Client Secret"
                        {...register('trakt.client_secret')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleShowKey('trakt-client-secret')}
                      >
                        {showKeys['trakt-client-secret'] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {errors.trakt?.client_secret && (
                      <p className="text-sm text-destructive">
                        {errors.trakt.client_secret.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trakt-pin">PIN (Optional)</Label>
                    <Input
                      id="trakt-pin"
                      type="text"
                      placeholder="Authorization PIN"
                      {...register('trakt.pin')}
                    />
                    {errors.trakt?.pin && (
                      <p className="text-sm text-destructive">
                        {errors.trakt.pin.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Create an app at{' '}
                      <a
                        href="https://trakt.tv/oauth/applications"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Trakt Applications
                      </a>
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => validateKey('trakt')}
                      disabled={
                        !watch('trakt.client_id') ||
                        !watch('trakt.client_secret') ||
                        validateKeyMutation.isPending
                      }
                    >
                      {validateKeyMutation.isPending &&
                      validateKeyMutation.variables?.service === 'trakt' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Validate'
                      )}
                    </Button>
                  </div>
                </div>

                {validationResults.trakt && (
                  <Alert
                    variant={
                      validationResults.trakt.valid ? 'default' : 'destructive'
                    }
                  >
                    <div className="flex items-start gap-2">
                      {validationResults.trakt.valid ? (
                        <CheckCircle2 className="h-4 w-4 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 mt-0.5" />
                      )}
                      <AlertDescription>
                        {validationResults.trakt.message}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="imdb">
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">IMDb</h2>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imdb">API Key (Optional)</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="imdb"
                        type={showKeys.imdb ? 'text' : 'password'}
                        placeholder="Your IMDb API key"
                        {...register('imdb')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => toggleShowKey('imdb')}
                      >
                        {showKeys.imdb ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => validateKey('imdb')}
                      disabled={!watch('imdb') || validateKeyMutation.isPending}
                    >
                      {validateKeyMutation.isPending &&
                      validateKeyMutation.variables?.service === 'imdb' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Validate'
                      )}
                    </Button>
                  </div>
                  {errors.imdb && (
                    <p className="text-sm text-destructive">
                      {errors.imdb.message}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    IMDb API key is optional but recommended for better metadata
                    matching
                  </p>
                </div>

                {validationResults.imdb && (
                  <Alert
                    variant={
                      validationResults.imdb.valid ? 'default' : 'destructive'
                    }
                  >
                    <div className="flex items-start gap-2">
                      {validationResults.imdb.valid ? (
                        <CheckCircle2 className="h-4 w-4 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 mt-0.5" />
                      )}
                      <AlertDescription>
                        {validationResults.imdb.message}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="anidb">
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">AniDB</h2>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="anidb-client">Client Name</Label>
                    <Input
                      id="anidb-client"
                      placeholder="Your AniDB client name"
                      {...register('anidb.client')}
                    />
                    {errors.anidb?.client && (
                      <p className="text-sm text-destructive">
                        {errors.anidb.client.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anidb-version">Version</Label>
                    <Input
                      id="anidb-version"
                      placeholder="Client version (e.g., 1)"
                      {...register('anidb.version')}
                    />
                    {errors.anidb?.version && (
                      <p className="text-sm text-destructive">
                        {errors.anidb.version.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anidb-language">Language</Label>
                    <Input
                      id="anidb-language"
                      placeholder="Language code (default: en)"
                      {...register('anidb.language')}
                    />
                    {errors.anidb?.language && (
                      <p className="text-sm text-destructive">
                        {errors.anidb.language.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Register at{' '}
                      <a
                        href="https://anidb.net/software/add"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        AniDB Software Registration
                      </a>
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => validateKey('anidb')}
                      disabled={
                        !watch('anidb.client') ||
                        !watch('anidb.version') ||
                        validateKeyMutation.isPending
                      }
                    >
                      {validateKeyMutation.isPending &&
                      validateKeyMutation.variables?.service === 'anidb' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Validate'
                      )}
                    </Button>
                  </div>
                </div>

                {validationResults.anidb && (
                  <Alert
                    variant={
                      validationResults.anidb.valid ? 'default' : 'destructive'
                    }
                  >
                    <div className="flex items-start gap-2">
                      {validationResults.anidb.valid ? (
                        <CheckCircle2 className="h-4 w-4 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 mt-0.5" />
                      )}
                      <AlertDescription>
                        {validationResults.anidb.message}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3">
          <Button
            type="submit"
            disabled={isSubmitting || saveKeysMutation.isPending}
          >
            {saveKeysMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save API Keys'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
