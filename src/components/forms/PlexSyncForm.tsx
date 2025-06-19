'use client';

import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, Server, Library } from 'lucide-react';
import { PlexConfigForm } from '@/lib/schemas/forms';
import { useState } from 'react';

interface PlexLibrary {
  key: string;
  title: string;
  type: string;
  updatedAt?: number;
}

interface PlexConnectionTestResult {
  success: boolean;
  error?: string;
  serverInfo?: {
    friendlyName: string;
    version: string;
    platform: string;
    machineIdentifier: string;
  };
  libraries?: PlexLibrary[];
}

interface PlexSyncFormProps {
  form: UseFormReturn<PlexConfigForm>;
  disabled?: boolean;
}

export function PlexSyncForm({ form, disabled = false }: PlexSyncFormProps) {
  const [testResult, setTestResult] = useState<PlexConnectionTestResult | null>(
    null
  );
  const [selectedLibraries, setSelectedLibraries] = useState<Set<string>>(
    new Set()
  );

  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;

  // Watch for selectedLibraries changes and update form
  useEffect(() => {
    setValue('selectedLibraries', Array.from(selectedLibraries));
  }, [selectedLibraries, setValue]);

  const testConnectionMutation = useMutation({
    mutationFn: async (data: { url: string; token: string }) => {
      const response = await fetch('/api/config/plex/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Connection test failed');
      }
      return response.json();
    },
    onSuccess: (data: PlexConnectionTestResult) => {
      setTestResult(data);
      setValue('connectionStatus', 'connected');
      setValue('availableLibraries', data.libraries);
    },
    onError: (error: Error) => {
      setTestResult({
        success: false,
        error: error.message,
      });
      setValue('connectionStatus', 'error');
    },
  });

  const handleTestConnection = () => {
    const formData = watch();
    if (formData.url && formData.token) {
      setValue('connectionStatus', 'testing');
      testConnectionMutation.mutate({
        url: formData.url,
        token: formData.token,
      });
    }
  };

  const toggleLibrary = (libraryTitle: string) => {
    const newSelected = new Set(selectedLibraries);
    if (newSelected.has(libraryTitle)) {
      newSelected.delete(libraryTitle);
    } else {
      newSelected.add(libraryTitle);
    }
    setSelectedLibraries(newSelected);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Server Connection</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plex-url">Plex Server URL</Label>
            <Input
              id="plex-url"
              placeholder="http://localhost:32400"
              disabled={disabled}
              {...register('url')}
              aria-describedby="plex-url-error"
            />
            {errors.url && (
              <p
                id="plex-url-error"
                className="text-sm text-destructive"
                data-testid="plex-url-error"
              >
                {typeof errors.url.message === 'string'
                  ? errors.url.message
                  : 'Invalid URL'}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Enter your Plex server URL including the port (usually 32400)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plex-token">Plex Token</Label>
            <Input
              id="plex-token"
              type="password"
              placeholder="Your Plex authentication token"
              disabled={disabled}
              {...register('token')}
              aria-describedby="plex-token-error"
            />
            {errors.token && (
              <p id="plex-token-error" className="text-sm text-destructive">
                {typeof errors.token.message === 'string'
                  ? errors.token.message
                  : 'Invalid token'}
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
                disabled ||
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
            <Alert
              variant={testResult.success ? 'default' : 'destructive'}
              data-testid="plex-connection-result"
            >
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5" />
                )}
                <AlertDescription>
                  {testResult.success
                    ? `Connection successful. Successfully connected to ${testResult.serverInfo?.friendlyName || 'Plex server'}`
                    : testResult.error}
                </AlertDescription>
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
              <h3 className="text-lg font-semibold">Select Libraries</h3>
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
                    checked={selectedLibraries.has(library.title)}
                    onCheckedChange={() => toggleLibrary(library.title)}
                    disabled={disabled}
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
                      <p>Key: {library.key}</p>
                      {library.updatedAt && (
                        <p>
                          Last Updated:{' '}
                          {new Date(
                            library.updatedAt * 1000
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
