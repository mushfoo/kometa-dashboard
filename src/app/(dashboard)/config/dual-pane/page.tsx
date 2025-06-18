'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SplitPane } from '@rexxars/react-split-pane';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { YamlEditor } from '@/components/editor/YamlEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Save,
  FileCode,
  Settings,
  Info,
  RotateCcw,
} from 'lucide-react';

export default function DualPaneConfigPage() {
  const [yamlContent, setYamlContent] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [paneSize, setPaneSize] = useState<number>(400);
  const [activeTab, setActiveTab] = useState('plex');
  const queryClient = useQueryClient();

  // Load saved pane size from localStorage
  useEffect(() => {
    const savedSize = localStorage.getItem('config-pane-size');
    if (savedSize) {
      const numericSize = parseInt(savedSize, 10);
      if (!isNaN(numericSize)) {
        setPaneSize(numericSize);
      }
    }
  }, []);

  // Save pane size to localStorage when it changes
  const handlePaneChange = useCallback((size: number) => {
    localStorage.setItem('config-pane-size', size.toString());
  }, []);

  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ['yaml-config'],
    queryFn: async () => {
      const response = await fetch('/api/config/yaml');
      if (!response.ok) throw new Error('Failed to load YAML configuration');
      const data = await response.json();
      setYamlContent(data.yaml || '');
      return data;
    },
  });

  const handleYamlChange = (newValue: string) => {
    setYamlContent(newValue);
    setHasChanges(true);
  };

  const handleValidationChange = (valid: boolean) => {
    setIsValid(valid);
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Configuration Editor
          </h1>
          <p className="text-muted-foreground">
            Configure Kometa using forms or edit the YAML directly.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saveConfigMutation.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
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

      {hasChanges && (
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Changes in the form will automatically
            update the YAML, and vice versa.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 min-h-0" style={{ height: 'calc(100vh - 300px)' }}>
        <SplitPane
          split="vertical"
          minSize={300}
          maxSize={-300}
          defaultSize={paneSize}
          onChange={handlePaneChange}
          paneStyle={{ overflow: 'auto' }}
        >
          {/* Left Pane - Forms */}
          <div className="h-full pr-2">
            <Card className="h-full p-6 overflow-auto">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Configuration Forms</h2>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="plex">Plex</TabsTrigger>
                  <TabsTrigger value="apis">API Keys</TabsTrigger>
                  <TabsTrigger value="libraries">Libraries</TabsTrigger>
                </TabsList>

                <TabsContent value="plex" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Configure your Plex server connection settings here.
                      Changes will be reflected in the YAML editor.
                    </p>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Form-YAML synchronization will be implemented in the
                        next task.
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>

                <TabsContent value="apis" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Manage your API keys for external services.
                    </p>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Form-YAML synchronization will be implemented in the
                        next task.
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>

                <TabsContent value="libraries" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Configure library-specific settings.
                    </p>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Form-YAML synchronization will be implemented in the
                        next task.
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Pane - YAML Editor */}
          <div className="h-full pl-2">
            <Card className="h-full p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileCode className="h-5 w-5" />
                <h2 className="text-lg font-semibold">YAML Editor</h2>
              </div>

              <YamlEditor
                value={yamlContent}
                onChange={handleYamlChange}
                onValidationChange={handleValidationChange}
                height="calc(100% - 40px)"
                showToolbar={true}
              />
            </Card>
          </div>
        </SplitPane>
      </div>
    </div>
  );
}
