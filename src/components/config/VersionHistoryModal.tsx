'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  FileText,
  GitBranch,
  ArrowRight,
  RotateCcw,
  Trash2,
  X,
  Upload,
  Settings,
  FileCode,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { YamlEditor } from '@/components/editor/YamlEditor';
import {
  VersionHistoryService,
  type ConfigVersion,
  type VersionDiff,
} from '@/lib/VersionHistoryService';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYaml?: string;
  // eslint-disable-next-line no-unused-vars
  onRestoreVersion: (yaml: string) => void;
}

export function VersionHistoryModal({
  isOpen,
  onClose,
  onRestoreVersion,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ConfigVersion | null>(
    null
  );
  const [compareVersion, setCompareVersion] = useState<ConfigVersion | null>(
    null
  );
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'compare' | 'preview'>(
    'history'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const versionService = useMemo(() => new VersionHistoryService(), []);

  const loadVersionHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const history = await versionService.getVersionHistory();
      setVersions(history);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load version history'
      );
    } finally {
      setIsLoading(false);
    }
  }, [versionService]);

  useEffect(() => {
    if (isOpen) {
      loadVersionHistory();
    }
  }, [isOpen, loadVersionHistory]);

  const handleCompareVersions = async (
    fromVersion: ConfigVersion,
    toVersion: ConfigVersion
  ) => {
    try {
      const versionDiff = await versionService.compareVersions(
        fromVersion.id,
        toVersion.id
      );
      setDiff(versionDiff);
      setCompareVersion(fromVersion);
      setSelectedVersion(toVersion);
      setActiveTab('compare');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to compare versions'
      );
    }
  };

  const handleRestoreVersion = async () => {
    if (!selectedVersion) return;

    try {
      onRestoreVersion(selectedVersion.yaml);
      setShowRestoreConfirm(false);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to restore version'
      );
    }
  };

  const handleDeleteVersion = async (
    versionId: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();

    try {
      await versionService.deleteVersion(versionId);
      await loadVersionHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete version');
    }
  };

  const getChangeIcon = (changeType: ConfigVersion['changeType']) => {
    switch (changeType) {
      case 'template':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'import':
        return <Upload className="h-4 w-4 text-green-500" />;
      case 'form':
        return <Settings className="h-4 w-4 text-purple-500" />;
      default:
        return <FileCode className="h-4 w-4 text-gray-500" />;
    }
  };

  const getChangeTypeLabel = (changeType: ConfigVersion['changeType']) => {
    switch (changeType) {
      case 'template':
        return 'Template Applied';
      case 'import':
        return 'Configuration Imported';
      case 'form':
        return 'Form Updated';
      default:
        return 'Manual Edit';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-7xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex h-full max-h-[90vh]">
          {/* Left Panel - Version List */}
          <div className="w-1/3 border-r flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Version History</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                View and restore previous configuration versions
              </p>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading history...
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No version history available
                </div>
              ) : (
                versions.map((version, index) => (
                  <Card
                    key={version.id}
                    className={cn(
                      'p-4 cursor-pointer transition-all hover:shadow-md',
                      selectedVersion?.id === version.id
                        ? 'ring-2 ring-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    )}
                    onClick={() => {
                      setSelectedVersion(version);
                      setActiveTab('preview');
                    }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getChangeIcon(version.changeType)}
                          <div>
                            <p className="font-medium text-sm">
                              {version.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {getChangeTypeLabel(version.changeType)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {index > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const previousVersion = versions[index - 1];
                                if (previousVersion) {
                                  handleCompareVersions(
                                    version,
                                    previousVersion
                                  );
                                }
                              }}
                              title="Compare with previous version"
                            >
                              <GitBranch className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteVersion(version.id, e)}
                            title="Delete version"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>
                          {VersionHistoryService.formatTimestamp(
                            version.timestamp
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span>
                            {VersionHistoryService.formatFileSize(version.size)}
                          </span>
                          {version.stats?.collections && (
                            <span>
                              📁 {version.stats.collections} collections
                            </span>
                          )}
                          {version.stats?.libraries && (
                            <span>📚 {version.stats.libraries} libraries</span>
                          )}
                        </div>
                        {version.stats?.features &&
                          version.stats.features.length > 0 && (
                            <div>⚡ {version.stats.features.join(', ')}</div>
                          )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Right Panel - Version Details */}
          <div className="w-2/3 flex flex-col">
            {selectedVersion ? (
              <>
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">
                      {selectedVersion.description}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRestoreConfirm(true)}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getChangeTypeLabel(selectedVersion.changeType)} •{' '}
                    {VersionHistoryService.formatTimestamp(
                      selectedVersion.timestamp
                    )}
                  </p>
                </div>

                <div className="flex-1 overflow-hidden">
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab as any}
                    className="h-full flex flex-col"
                  >
                    <TabsList className="grid w-full grid-cols-3 m-4 mb-0">
                      <TabsTrigger value="preview">Preview</TabsTrigger>
                      <TabsTrigger value="compare" disabled={!diff}>
                        Compare
                      </TabsTrigger>
                      <TabsTrigger value="history">Timeline</TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="preview"
                      className="flex-1 overflow-auto p-4 pt-2 m-0"
                    >
                      <YamlEditor
                        value={selectedVersion.yaml}
                        onChange={() => {}} // Read-only
                        readOnly={true}
                        height="100%"
                        showToolbar={false}
                      />
                    </TabsContent>

                    <TabsContent
                      value="compare"
                      className="flex-1 overflow-auto p-4 pt-2 m-0"
                    >
                      {diff && compareVersion && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">
                              {compareVersion.description}
                            </span>
                            <ArrowRight className="h-4 w-4" />
                            <span className="font-medium">
                              {selectedVersion.description}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {diff.added.length > 0 && (
                              <Card className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                                  <h4 className="font-medium text-sm">
                                    Added ({diff.added.length})
                                  </h4>
                                </div>
                                <div className="space-y-1 text-xs">
                                  {diff.added
                                    .slice(0, 10)
                                    .map((item, index) => (
                                      <div
                                        key={index}
                                        className="text-green-600 dark:text-green-400"
                                      >
                                        + {item}
                                      </div>
                                    ))}
                                  {diff.added.length > 10 && (
                                    <div className="text-muted-foreground">
                                      ... and {diff.added.length - 10} more
                                    </div>
                                  )}
                                </div>
                              </Card>
                            )}

                            {diff.removed.length > 0 && (
                              <Card className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                                  <h4 className="font-medium text-sm">
                                    Removed ({diff.removed.length})
                                  </h4>
                                </div>
                                <div className="space-y-1 text-xs">
                                  {diff.removed
                                    .slice(0, 10)
                                    .map((item, index) => (
                                      <div
                                        key={index}
                                        className="text-red-600 dark:text-red-400"
                                      >
                                        - {item}
                                      </div>
                                    ))}
                                  {diff.removed.length > 10 && (
                                    <div className="text-muted-foreground">
                                      ... and {diff.removed.length - 10} more
                                    </div>
                                  )}
                                </div>
                              </Card>
                            )}

                            {diff.modified.length > 0 && (
                              <Card className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                                  <h4 className="font-medium text-sm">
                                    Modified ({diff.modified.length})
                                  </h4>
                                </div>
                                <div className="space-y-1 text-xs">
                                  {diff.modified
                                    .slice(0, 10)
                                    .map((item, index) => (
                                      <div
                                        key={index}
                                        className="text-blue-600 dark:text-blue-400"
                                      >
                                        ~ {item.path}
                                      </div>
                                    ))}
                                  {diff.modified.length > 10 && (
                                    <div className="text-muted-foreground">
                                      ... and {diff.modified.length - 10} more
                                    </div>
                                  )}
                                </div>
                              </Card>
                            )}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent
                      value="history"
                      className="flex-1 overflow-auto p-4 pt-2 m-0"
                    >
                      <div className="space-y-4">
                        {versions.map((version, index) => (
                          <div
                            key={version.id}
                            className="flex items-start gap-3"
                          >
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  'w-3 h-3 rounded-full',
                                  version.id === selectedVersion.id
                                    ? 'bg-primary'
                                    : 'bg-muted-foreground'
                                )}
                              ></div>
                              {index < versions.length - 1 && (
                                <div className="w-px h-8 bg-border mt-2"></div>
                              )}
                            </div>
                            <div className="flex-1 pb-6">
                              <div className="flex items-center gap-2 mb-1">
                                {getChangeIcon(version.changeType)}
                                <span className="font-medium text-sm">
                                  {version.description}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">
                                {VersionHistoryService.formatTimestamp(
                                  version.timestamp
                                )}
                              </p>
                              {version.stats && (
                                <div className="text-xs text-muted-foreground">
                                  {version.stats.collections &&
                                    `📁 ${version.stats.collections} collections`}
                                  {version.stats.libraries &&
                                    ` • 📚 ${version.stats.libraries} libraries`}
                                  {version.stats.features &&
                                    version.stats.features.length > 0 &&
                                    ` • ⚡ ${version.stats.features.join(', ')}`}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-6">
                <div className="space-y-2">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="font-medium">Select a Version</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a version from the history to view details and
                    compare changes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="m-6 mt-0">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Restore Confirmation Dialog */}
        {showRestoreConfirm && selectedVersion && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Card className="max-w-md w-full m-4">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <RotateCcw className="h-5 w-5 text-amber-500" />
                  <h3 className="text-lg font-semibold">Restore Version</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Are you sure you want to restore &quot;
                  {selectedVersion.description}&quot;? This will replace your
                  current configuration.
                </p>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowRestoreConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleRestoreVersion}>
                    <Check className="h-4 w-4 mr-2" />
                    Restore Version
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
}
