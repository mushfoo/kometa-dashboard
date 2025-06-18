'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { YamlEditor } from '@/components/editor/YamlEditor';
import {
  Loader2,
  Save,
  RotateCcw,
  FileText,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';

export default function YamlEditorPage() {
  const [yamlContent, setYamlContent] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ['yaml-config'],
    queryFn: async () => {
      const response = await fetch('/api/config/yaml');
      if (!response.ok) throw new Error('Failed to load YAML configuration');
      const data = await response.json();
      setYamlContent(data.yaml);
      return data;
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (yaml: string) => {
      const response = await fetch('/api/config/yaml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save YAML configuration');
      }
      return response.json();
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['yaml-config'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });

  const validateConfigMutation = useMutation({
    mutationFn: async (yaml: string) => {
      const response = await fetch('/api/config/yaml/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Validation failed');
      }
      return response.json();
    },
  });

  const handleYamlChange = (newValue: string) => {
    setYamlContent(newValue);
    setHasChanges(true);
  };

  const handleValidationChange = (valid: boolean) => {
    setIsValid(valid);
  };

  const handleSave = async () => {
    if (!isValid) {
      return;
    }
    await saveConfigMutation.mutateAsync(yamlContent);
  };

  const handleReset = () => {
    if (currentConfig?.yaml) {
      setYamlContent(currentConfig.yaml);
      setHasChanges(false);
    }
  };

  const handleValidateConfig = () => {
    validateConfigMutation.mutate(yamlContent);
  };

  const downloadConfig = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kometa-config-${new Date().toISOString().split('T')[0]}.yml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const uploadConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setYamlContent(content);
        setHasChanges(true);
      };
      reader.readAsText(file);
    }
    // Reset input
    event.target.value = '';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            YAML Configuration Editor
          </h1>
          <p className="text-muted-foreground">
            Edit your Kometa configuration directly in YAML format.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={downloadConfig}
            disabled={!yamlContent}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            onClick={() => document.getElementById('config-upload')?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          <input
            id="config-upload"
            type="file"
            accept=".yml,.yaml"
            onChange={uploadConfig}
            className="hidden"
          />
        </div>
      </div>

      {hasChanges && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Make sure to save your configuration
            before leaving this page.
          </AlertDescription>
        </Alert>
      )}

      {validateConfigMutation.data && (
        <Alert
          variant={
            validateConfigMutation.data.valid ? 'default' : 'destructive'
          }
        >
          <div className="flex items-start gap-2">
            {validateConfigMutation.data.valid ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 mt-0.5" />
            )}
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">
                  {validateConfigMutation.data.valid
                    ? 'Configuration is valid!'
                    : 'Configuration validation failed'}
                </p>
                {validateConfigMutation.data.message && (
                  <p className="text-sm">
                    {validateConfigMutation.data.message}
                  </p>
                )}
                {validateConfigMutation.data.errors && (
                  <div className="space-y-1">
                    {validateConfigMutation.data.errors.map(
                      (error: string, index: number) => (
                        <p key={index} className="text-sm">
                          • {error}
                        </p>
                      )
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </div>
        </Alert>
      )}

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Configuration Editor</h2>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidateConfig}
                disabled={!yamlContent || validateConfigMutation.isPending}
              >
                {validateConfigMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Validate'
                )}
              </Button>
            </div>
          </div>

          <YamlEditor
            value={yamlContent}
            onChange={handleYamlChange}
            onValidationChange={handleValidationChange}
            height="600px"
            showToolbar={false}
            placeholder="# Kometa Configuration
# This is your main Kometa configuration file
# 
# Example structure:
# plex:
#   url: http://localhost:32400
#   token: YOUR_PLEX_TOKEN
#
# tmdb:
#   apikey: YOUR_TMDB_API_KEY
#
# libraries:
#   Movies:
#     collections:
#       - tmdb_popular
#   TV Shows:
#     collections:
#       - tmdb_trending
"
          />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges || saveConfigMutation.isPending}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Changes
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isValid || !hasChanges || saveConfigMutation.isPending}
        >
          {saveConfigMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
