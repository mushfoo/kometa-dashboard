'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  FileCode,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function SyncConflictDialog<T extends Record<string, any>>({
  conflict,
  onResolve,
  onCancel,
}: SyncConflictDialogProps<T>) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<
    'accept_form' | 'accept_yaml' | 'merge' | null
  >(null);

  const formatData = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

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
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden">
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

            {/* Conflict Details */}
            {showDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="h-4 w-4" />
                    <h4 className="font-medium">Form Data</h4>
                  </div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {formatData(conflict.formData)}
                  </pre>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileCode className="h-4 w-4" />
                    <h4 className="font-medium">YAML Data</h4>
                  </div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {formatData(conflict.yamlData)}
                  </pre>
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
