'use client';

import { UseFormReturn } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation } from '@tanstack/react-query';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Key,
  ExternalLink,
} from 'lucide-react';
import { ApiKeysFormSchema } from '@/lib/schemas/forms';
import { useState } from 'react';

interface ApiKeyTestResult {
  service: string;
  success: boolean;
  error?: string;
  details?: string;
}

interface ApiKeysSyncFormProps {
  form: UseFormReturn<ApiKeysFormSchema>;
  disabled?: boolean;
}

export function ApiKeysSyncForm({
  form,
  disabled = false,
}: ApiKeysSyncFormProps) {
  const [testResults, setTestResults] = useState<
    Record<string, ApiKeyTestResult>
  >({});

  const {
    register,
    formState: { errors },
    watch,
  } = form;

  const testApiKeyMutation = useMutation({
    mutationFn: async ({ service, key }: { service: string; key: string }) => {
      const response = await fetch(`/api/config/api-keys/validate/${service}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API key test failed');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      setTestResults((prev) => ({
        ...prev,
        [variables.service]: {
          service: variables.service,
          success: true,
          details: data.details,
        },
      }));
    },
    onError: (error: Error, variables) => {
      setTestResults((prev) => ({
        ...prev,
        [variables.service]: {
          service: variables.service,
          success: false,
          error: error.message,
        },
      }));
    },
  });

  const handleTestApiKey = (service: string, key: string) => {
    if (key.trim()) {
      testApiKeyMutation.mutate({ service, key });
    }
  };

  const getTestResult = (service: string) => testResults[service];

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-5 w-5" />
            <h3 className="text-lg font-semibold">API Keys</h3>
          </div>

          {/* TMDb API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tmdb-key">TMDb API Key</Label>
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                Get API Key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <Input
                id="tmdb-key"
                placeholder="32-character hexadecimal string"
                disabled={disabled}
                {...register('tmdb')}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTestApiKey('tmdb', watch('tmdb') || '')}
                disabled={
                  disabled || !watch('tmdb') || testApiKeyMutation.isPending
                }
              >
                {testApiKeyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Test'
                )}
              </Button>
            </div>
            {errors.tmdb && (
              <p className="text-sm text-destructive">{errors.tmdb.message}</p>
            )}
            {getTestResult('tmdb') && (
              <Alert
                variant={
                  getTestResult('tmdb')?.success ? 'default' : 'destructive'
                }
                className="text-sm"
              >
                <div className="flex items-start gap-2">
                  {getTestResult('tmdb')?.success ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5" />
                  )}
                  <AlertDescription>
                    {getTestResult('tmdb')?.success
                      ? getTestResult('tmdb')?.details ||
                        'TMDb API key is valid'
                      : getTestResult('tmdb')?.error}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </div>

          {/* Trakt Client ID */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="trakt-client-id">Trakt Client ID</Label>
              <a
                href="https://trakt.tv/oauth/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                Create App <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Input
              id="trakt-client-id"
              placeholder="64-character hexadecimal string"
              disabled={disabled}
              {...register('trakt.client_id')}
            />
            {errors.trakt?.client_id && (
              <p className="text-sm text-destructive">
                {errors.trakt.client_id.message}
              </p>
            )}
          </div>

          {/* Trakt Client Secret */}
          <div className="space-y-2">
            <Label htmlFor="trakt-client-secret">Trakt Client Secret</Label>
            <Input
              id="trakt-client-secret"
              type="password"
              placeholder="64-character hexadecimal string"
              disabled={disabled}
              {...register('trakt.client_secret')}
            />
            {errors.trakt?.client_secret && (
              <p className="text-sm text-destructive">
                {errors.trakt.client_secret.message}
              </p>
            )}
          </div>

          {/* Trakt PIN */}
          <div className="space-y-2">
            <Label htmlFor="trakt-pin">Trakt PIN (Optional)</Label>
            <Input
              id="trakt-pin"
              placeholder="Enter PIN from Trakt authorization"
              disabled={disabled}
              {...register('trakt.pin')}
            />
            <p className="text-sm text-muted-foreground">
              Generated during Trakt OAuth flow
            </p>
          </div>

          {/* IMDb User ID */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="imdb-user">IMDb User ID</Label>
              <a
                href="https://www.imdb.com/registration/signin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                Find User ID <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <Input
                id="imdb-user"
                placeholder="ur12345678"
                disabled={disabled}
                {...register('imdb')}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTestApiKey('imdb', watch('imdb') || '')}
                disabled={
                  disabled || !watch('imdb') || testApiKeyMutation.isPending
                }
              >
                {testApiKeyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Test'
                )}
              </Button>
            </div>
            {errors.imdb && (
              <p className="text-sm text-destructive">{errors.imdb.message}</p>
            )}
            {getTestResult('imdb') && (
              <Alert
                variant={
                  getTestResult('imdb')?.success ? 'default' : 'destructive'
                }
                className="text-sm"
              >
                <div className="flex items-start gap-2">
                  {getTestResult('imdb')?.success ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5" />
                  )}
                  <AlertDescription>
                    {getTestResult('imdb')?.success
                      ? getTestResult('imdb')?.details ||
                        'IMDb User ID is valid'
                      : getTestResult('imdb')?.error}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </div>

          {/* AniDB Client */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="anidb-client">AniDB Client</Label>
              <a
                href="https://anidb.net/software/add"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                Register Client <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Input
              id="anidb-client"
              placeholder="Your registered client name"
              disabled={disabled}
              {...register('anidb.client')}
            />
            {errors.anidb?.client && (
              <p className="text-sm text-destructive">
                {errors.anidb.client.message}
              </p>
            )}
          </div>

          {/* AniDB Version */}
          <div className="space-y-2">
            <Label htmlFor="anidb-version">AniDB Client Version</Label>
            <Input
              id="anidb-version"
              placeholder="1.0"
              disabled={disabled}
              {...register('anidb.version')}
            />
          </div>

          {/* AniDB Language */}
          <div className="space-y-2">
            <Label htmlFor="anidb-language">AniDB Language</Label>
            <Input
              id="anidb-language"
              placeholder="en"
              disabled={disabled}
              {...register('anidb.language')}
            />
            <p className="text-sm text-muted-foreground">
              Language code (e.g., en, ja, de)
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
