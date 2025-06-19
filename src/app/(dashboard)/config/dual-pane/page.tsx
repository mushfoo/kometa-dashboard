'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SplitPane } from '@rexxars/react-split-pane';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { YamlEditor } from '@/components/editor/YamlEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlexSyncForm } from '@/components/forms/PlexSyncForm';
import { ApiKeysSyncForm } from '@/components/forms/ApiKeysSyncForm';
import { SyncConflictDialog } from '@/components/forms/SyncConflictDialog';
import { TemplateSelectionModal } from '@/components/config/TemplateSelectionModal';
import { SaveTemplateModal } from '@/components/config/SaveTemplateModal';
import { VersionHistoryModal } from '@/components/config/VersionHistoryModal';
import { useFormYamlSync } from '@/hooks/useFormYamlSync';
import {
  dualPaneConfigSchema,
  type DualPaneConfigForm,
} from '@/lib/schemas/forms';
import {
  Loader2,
  Save,
  FileCode,
  Settings,
  Info,
  RotateCcw,
  AlertTriangle,
  FileText,
  Download,
  Clock,
} from 'lucide-react';

export default function DualPaneConfigPage() {
  const [paneSize, setPaneSize] = useState<number>(400);
  const [activeTab, setActiveTab] = useState('plex');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
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
      return data;
    },
  });

  // Use the form-YAML synchronization hook
  const {
    form,
    yamlContent,
    setYamlContent,
    isValid,
    validationErrors,
    hasChanges,
    lastUpdatedBy,
    syncConflict,
    resolveSyncConflict,
    resetToOriginal,
  } = useFormYamlSync<DualPaneConfigForm>({
    schema: dualPaneConfigSchema,
    initialYaml: currentConfig?.yaml || '',
    onFormChange: (data) => {
      console.log('Form changed:', data);
    },
    onYamlChange: (yaml) => {
      console.log('YAML changed:', yaml);
    },
    onSyncConflict: (conflict) => {
      console.log('Sync conflict detected:', conflict);
    },
    debounceMs: 300,
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
    onSuccess: async () => {
      // Save to version history
      try {
        const versionService = await import('@/lib/VersionHistoryService');
        const service = new versionService.VersionHistoryService();
        await service.saveVersion(
          yamlContent,
          `Configuration saved on ${new Date().toLocaleDateString()}`,
          'manual'
        );
      } catch (error) {
        console.error('Failed to save version history:', error);
      }

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

  const handleValidationChange = (valid: boolean, errors: string[]) => {
    console.log('YAML validation changed:', { valid, errors });
  };

  const handleTemplateSelect = async (
    template: any,
    customizations?: Record<string, any>
  ) => {
    try {
      const templateService = await import('@/lib/TemplateService');
      const service = new templateService.TemplateService();
      const appliedYaml = await service.applyTemplate(
        template.id,
        customizations
      );
      setYamlContent(appliedYaml);

      // Save to version history
      try {
        const versionService = await import('@/lib/VersionHistoryService');
        const historyService = new versionService.VersionHistoryService();
        await historyService.saveVersion(
          appliedYaml,
          `Applied template: ${template.name}`,
          'template'
        );
      } catch (error) {
        console.error('Failed to save template application to history:', error);
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
    }
  };

  const handleSaveTemplate = (template: any) => {
    console.log('Template saved:', template);
    // Optionally show a success message
  };

  const handleRestoreVersion = (yaml: string) => {
    setYamlContent(yaml);
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
            onClick={() => setShowTemplateModal(true)}
            disabled={saveConfigMutation.isPending}
          >
            <FileText className="mr-2 h-4 w-4" />
            Load Template
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowSaveTemplateModal(true)}
            disabled={!yamlContent.trim() || saveConfigMutation.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            Save as Template
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowVersionHistoryModal(true)}
            disabled={saveConfigMutation.isPending}
          >
            <Clock className="mr-2 h-4 w-4" />
            Version History
          </Button>
          <Button
            variant="outline"
            onClick={resetToOriginal}
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
            update the YAML, and vice versa.{' '}
            {lastUpdatedBy && (
              <span className="text-xs">
                (Last updated by: {lastUpdatedBy === 'form' ? 'Form' : 'YAML'})
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {validationErrors.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Configuration Validation Errors:</p>
              {validationErrors.map((error, index) => (
                <p key={index} className="text-sm">
                  {error}
                </p>
              ))}
            </div>
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
                    <PlexSyncForm
                      form={form as any}
                      disabled={saveConfigMutation.isPending}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="apis" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Manage your API keys for external services. Changes will
                      be reflected in the YAML editor.
                    </p>
                    <ApiKeysSyncForm
                      form={form as any}
                      disabled={saveConfigMutation.isPending}
                    />
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
                        Library-specific forms will be implemented in a future
                        task. Use the YAML editor to configure libraries
                        directly.
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
                onChange={setYamlContent}
                onValidationChange={handleValidationChange}
                height="calc(100% - 40px)"
                showToolbar={true}
                hasChanges={hasChanges}
                originalValue={currentConfig?.yaml || ''}
              />
            </Card>
          </div>
        </SplitPane>
      </div>

      {/* Sync Conflict Dialog */}
      {syncConflict && (
        <SyncConflictDialog
          conflict={syncConflict}
          onResolve={resolveSyncConflict}
          onCancel={() => console.log('Conflict resolution cancelled')}
        />
      )}

      {/* Template Selection Modal */}
      <TemplateSelectionModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleTemplateSelect}
      />

      {/* Save Template Modal */}
      <SaveTemplateModal
        isOpen={showSaveTemplateModal}
        onClose={() => setShowSaveTemplateModal(false)}
        yamlContent={yamlContent}
        onSave={handleSaveTemplate}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={showVersionHistoryModal}
        onClose={() => setShowVersionHistoryModal(false)}
        currentYaml={yamlContent}
        onRestoreVersion={handleRestoreVersion}
      />
    </div>
  );
}
