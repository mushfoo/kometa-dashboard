'use client';

import { useState } from 'react';
import { CollectionBuilder } from '@/components/collections/CollectionBuilder';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Play, Loader2 } from 'lucide-react';

export default function CollectionsPage() {
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningOperation, setIsRunningOperation] = useState(false);
  const [shouldRunOperation, setShouldRunOperation] = useState(false);
  const [lastCreatedCollection, setLastCreatedCollection] = useState<{
    name: string;
    library: string;
  } | null>(null);

  const handleSaveCollection = async (collection: any) => {
    setSaveStatus({ type: null, message: '' });
    setIsSaving(true);

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(collection),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save collection');
      }

      setLastCreatedCollection({
        name: collection.name,
        library: collection.library,
      });

      setSaveStatus({
        type: 'success',
        message: `Collection "${collection.name}" saved to configuration!`,
      });

      // If the user wants to run the operation immediately
      if (shouldRunOperation) {
        await runCollectionOperation(collection.library);
      }

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSaveStatus({ type: null, message: '' });
      }, 5000);
    } catch (error) {
      setSaveStatus({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to save collection',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const runCollectionOperation = async (library?: string) => {
    setIsRunningOperation(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/operations/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'collections_only',
          parameters: {
            libraries: library ? [library] : undefined,
            verbosity: 'info',
            dryRun: false,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start operation');
      }

      setSaveStatus({
        type: 'success',
        message:
          'Collection operation started! Check the System Status page to monitor progress.',
      });
    } catch (error) {
      setSaveStatus({
        type: 'error',
        message: `Failed to start operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsRunningOperation(false);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold mb-6">Collections</h1>

      {saveStatus.type && (
        <Alert
          className={`mb-4 ${
            saveStatus.type === 'success'
              ? 'border-green-500 text-green-700 dark:text-green-300'
              : 'border-red-500 text-red-700 dark:text-red-300'
          }`}
        >
          {saveStatus.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{saveStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Run Operation Option */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100">
              Apply Collections to Plex
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              After creating a collection, you need to run an operation to apply
              it to your Plex server.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={shouldRunOperation}
                onChange={(e) => setShouldRunOperation(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Run automatically after creation</span>
            </label>
            {lastCreatedCollection && !shouldRunOperation && (
              <Button
                onClick={() =>
                  runCollectionOperation(lastCreatedCollection.library)
                }
                disabled={isRunningOperation}
                size="sm"
                variant="outline"
              >
                {isRunningOperation ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Now
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      <CollectionBuilder onSave={handleSaveCollection} isSaving={isSaving} />
    </>
  );
}
