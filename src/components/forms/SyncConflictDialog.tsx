'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  FileCode,
  Settings,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import yaml from 'yaml';

interface SyncConflict<T> {
  type: 'form_to_yaml' | 'yaml_to_form';
  formData: T;
  yamlData: any;
  timestamp: number;
}

interface SyncConflictDialogProps<T> {
  conflict: SyncConflict<T>;
  // eslint-disable-next-line no-unused-vars
  onResolve: (resolution: 'accept_form' | 'accept_yaml' | 'merge') => void;
  onCancel: () => void;
}

interface DiffLine {
  line: string;
  type: 'added' | 'removed' | 'unchanged';
  lineNumber?: number;
}

export function SyncConflictDialog<T extends Record<string, any>>({
  conflict,
  onResolve,
  onCancel,
}: SyncConflictDialogProps<T>) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<
    'accept_form' | 'accept_yaml' | 'merge' | null
  >(null);

  // Generate side-by-side diff
  const diffData = useMemo(() => {
    const formatData = (data: any) => {
      try {
        return yaml.stringify(data, {
          indent: 2,
          lineWidth: 80,
          minContentWidth: 40,
        });
      } catch {
        return String(data);
      }
    };
    const formYaml = formatData(conflict.formData);
    const yamlData = formatData(conflict.yamlData);

    const formLines = formYaml.split('\n');
    const yamlLines = yamlData.split('\n');

    // Simple diff algorithm - in a production app you'd use a library like diff2html
    const maxLines = Math.max(formLines.length, yamlLines.length);
    const leftDiff: DiffLine[] = [];
    const rightDiff: DiffLine[] = [];

    for (let i = 0; i < maxLines; i++) {
      const formLine = formLines[i] || '';
      const yamlLine = yamlLines[i] || '';

      if (formLine === yamlLine) {
        leftDiff.push({ line: formLine, type: 'unchanged', lineNumber: i + 1 });
        rightDiff.push({
          line: yamlLine,
          type: 'unchanged',
          lineNumber: i + 1,
        });
      } else {
        if (formLine) {
          leftDiff.push({ line: formLine, type: 'removed', lineNumber: i + 1 });
        }
        if (yamlLine) {
          rightDiff.push({ line: yamlLine, type: 'added', lineNumber: i + 1 });
        }

        // Add empty line to maintain alignment
        if (!formLine) {
          leftDiff.push({ line: '', type: 'unchanged', lineNumber: i + 1 });
        }
        if (!yamlLine) {
          rightDiff.push({ line: '', type: 'unchanged', lineNumber: i + 1 });
        }
      }
    }

    return { left: leftDiff, right: rightDiff };
  }, [conflict]);

  const getConflictDescription = () => {
    if (conflict.type === 'form_to_yaml') {
      return 'You made changes to the form while the YAML was also modified. Choose which changes to keep:';
    } else {
      return 'You made changes to the YAML while the form was also modified. Choose which changes to keep:';
    }
  };

  const handleResolve = () => {
    if (selectedResolution) {
      onResolve(selectedResolution);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden bg-background border shadow-lg">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Synchronization Conflict</h2>
          </div>

          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {getConflictDescription()}
            </AlertDescription>
          </Alert>

          <div className="space-y-4 mb-6">
            {/* Resolution Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card
                className={cn(
                  'p-4 cursor-pointer border-2 transition-colors',
                  selectedResolution === 'accept_form'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setSelectedResolution('accept_form')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4" />
                  <h3 className="font-medium">Use Form Changes</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Keep the changes made in the form and update the YAML to
                  match.
                </p>
              </Card>

              <Card
                className={cn(
                  'p-4 cursor-pointer border-2 transition-colors',
                  selectedResolution === 'accept_yaml'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setSelectedResolution('accept_yaml')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="h-4 w-4" />
                  <h3 className="font-medium">Use YAML Changes</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Keep the changes made in the YAML and update the form to
                  match.
                </p>
              </Card>

              <Card
                className={cn(
                  'p-4 cursor-pointer border-2 transition-colors',
                  selectedResolution === 'merge'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setSelectedResolution('merge')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <h3 className="font-medium">Merge Changes</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Attempt to combine changes from both form and YAML.
                </p>
              </Card>
            </div>

            {/* Toggle Details */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="mr-2 h-4 w-4" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Show Details
                </>
              )}
            </Button>

            {/* Enhanced Conflict Details with Side-by-Side Diff */}
            {showDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="h-4 w-4" />
                      <h4 className="font-medium">Form Data</h4>
                    </div>
                    <div className="text-xs bg-muted p-2 rounded overflow-auto max-h-60 font-mono">
                      {diffData.left.map((line, index) => (
                        <div
                          key={index}
                          className={cn(
                            'leading-relaxed px-1',
                            line.type === 'removed' &&
                              'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
                            line.type === 'unchanged' && 'text-muted-foreground'
                          )}
                        >
                          <span className="text-xs text-muted-foreground mr-2 select-none">
                            {line.lineNumber?.toString().padStart(3, ' ')}
                          </span>
                          <span
                            className={cn(
                              line.type === 'removed' &&
                                'bg-red-200 dark:bg-red-800/40'
                            )}
                          >
                            {line.line || ' '}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileCode className="h-4 w-4" />
                      <h4 className="font-medium">YAML Data</h4>
                    </div>
                    <div className="text-xs bg-muted p-2 rounded overflow-auto max-h-60 font-mono">
                      {diffData.right.map((line, index) => (
                        <div
                          key={index}
                          className={cn(
                            'leading-relaxed px-1',
                            line.type === 'added' &&
                              'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
                            line.type === 'unchanged' && 'text-muted-foreground'
                          )}
                        >
                          <span className="text-xs text-muted-foreground mr-2 select-none">
                            {line.lineNumber?.toString().padStart(3, ' ')}
                          </span>
                          <span
                            className={cn(
                              line.type === 'added' &&
                                'bg-green-200 dark:bg-green-800/40'
                            )}
                          >
                            {line.line || ' '}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <Card className="p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">
                      Diff Legend
                    </h4>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-200 dark:bg-red-800/40 rounded"></div>
                      <span>Removed from form (red highlight)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-200 dark:bg-green-800/40 rounded"></div>
                      <span>Added in YAML (green highlight)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-muted rounded"></div>
                      <span>Unchanged</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={!selectedResolution}
              className="min-w-24"
            >
              Resolve Conflict
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
