'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Download,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Copy,
  Save,
} from 'lucide-react';

interface ImportResult {
  success: boolean;
  message: string;
  warnings?: string[];
  errors?: string[];
  preview?: any;
}

interface ExportOptions {
  includeKeys: boolean;
  includeSettings: boolean;
  format: 'yaml' | 'json';
  filename: string;
}

export default function ImportExportPage() {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeKeys: false,
    includeSettings: true,
    format: 'yaml',
    filename: `kometa-config-${new Date().toISOString().split('T')[0]}`,
  });
  const queryClient = useQueryClient();

  const { isLoading } = useQuery({
    queryKey: ['config-export'],
    queryFn: async () => {
      const response = await fetch('/api/config/export');
      if (!response.ok) throw new Error('Failed to load configuration');
      return response.json();
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/config/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }

      return response.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      setImportPreview(data.preview);
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['config'] });
      }
    },
    onError: (error: Error) => {
      setImportResult({
        success: false,
        message: error.message,
      });
    },
  });

  const confirmImportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/config/import/confirm', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to confirm import');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setImportFile(null);
      setImportPreview(null);
      setImportResult({
        success: true,
        message: 'Configuration imported successfully!',
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (options: ExportOptions) => {
      const response = await fetch('/api/config/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      return response.blob();
    },
    onSuccess: (blob, options) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${options.filename}.${options.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
      setImportPreview(null);
    }
  };

  const handleImport = () => {
    if (importFile) {
      importMutation.mutate(importFile);
    }
  };

  const handleExport = () => {
    exportMutation.mutate(exportOptions);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Configuration Import/Export
        </h1>
        <p className="text-muted-foreground">
          Import configurations from files or export your current settings for
          backup or sharing.
        </p>
      </div>

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="export">Export Configuration</TabsTrigger>
          <TabsTrigger value="import">Import Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Download className="h-5 w-5" />
                <h2 className="text-lg font-semibold">
                  Export Current Configuration
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="filename">Filename</Label>
                  <Input
                    id="filename"
                    value={exportOptions.filename}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        filename: e.target.value,
                      })
                    }
                    placeholder="kometa-config-backup"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="format">Format</Label>
                  <select
                    id="format"
                    value={exportOptions.format}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        format: e.target.value as 'yaml' | 'json',
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="yaml">YAML (.yml)</option>
                    <option value="json">JSON (.json)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Export Options</Label>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="includeSettings"
                    checked={exportOptions.includeSettings}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        includeSettings: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <Label
                    htmlFor="includeSettings"
                    className="text-sm font-normal"
                  >
                    Include application settings
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="includeKeys"
                    checked={exportOptions.includeKeys}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        includeKeys: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <Label htmlFor="includeKeys" className="text-sm font-normal">
                    Include API keys (encrypted)
                  </Label>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {exportOptions.includeKeys
                    ? 'API keys will be included in encrypted form and can only be used with this application.'
                    : "API keys will not be included. You'll need to reconfigure them after importing."}
                </AlertDescription>
              </Alert>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleExport}
                  disabled={exportMutation.isPending}
                >
                  {exportMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Export Configuration
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Import Configuration</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="import-file">Select Configuration File</Label>
                  <Input
                    id="import-file"
                    type="file"
                    accept=".yml,.yaml,.json"
                    onChange={handleFileSelect}
                  />
                  <p className="text-sm text-muted-foreground">
                    Supports YAML (.yml, .yaml) and JSON (.json) files
                  </p>
                </div>

                {importFile && (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      Selected file:{' '}
                      <span data-testid="file-name">{importFile.name}</span> (
                      {(importFile.size / 1024).toFixed(1)} KB)
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={handleImport}
                    disabled={!importFile || importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Analyze Import
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {importResult && (
                <Alert
                  variant={importResult.success ? 'default' : 'destructive'}
                  data-testid={
                    importResult.success ? 'import-success' : 'import-error'
                  }
                >
                  <div className="flex items-start gap-2">
                    {importResult.success ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5" />
                    )}
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">{importResult.message}</p>

                        {importResult.errors &&
                          importResult.errors.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-sm font-medium">Errors:</p>
                              {importResult.errors.map((error, index) => (
                                <p key={index} className="text-sm">
                                  • {error}
                                </p>
                              ))}
                            </div>
                          )}

                        {importResult.warnings &&
                          importResult.warnings.length > 0 && (
                            <div
                              className="space-y-1"
                              data-testid="import-warning"
                            >
                              <p className="text-sm font-medium text-amber-600">
                                Warnings:
                              </p>
                              {importResult.warnings.map((warning, index) => (
                                <p
                                  key={index}
                                  className="text-sm text-amber-600"
                                >
                                  • {warning}
                                </p>
                              ))}
                            </div>
                          )}
                      </div>
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {importPreview && (
                <Card className="p-4" data-testid="import-preview">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Configuration Preview</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            JSON.stringify(importPreview, null, 2)
                          )
                        }
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>

                    <Textarea
                      value={JSON.stringify(importPreview, null, 2)}
                      readOnly
                      rows={10}
                      className="font-mono text-sm"
                    />

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setImportPreview(null);
                          setImportResult(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => confirmImportMutation.mutate()}
                        disabled={confirmImportMutation.isPending}
                      >
                        {confirmImportMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Confirm Import
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Importing a configuration will
                  overwrite your current settings. Make sure to export your
                  current configuration as a backup first.
                </AlertDescription>
              </Alert>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
