'use client';

import { useState } from 'react';
import { CollectionBuilder } from '@/components/collections/CollectionBuilder';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function CollectionsPage() {
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleSaveCollection = async (collection: any) => {
    setSaveStatus({ type: null, message: '' });

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

      setSaveStatus({
        type: 'success',
        message: `Collection "${collection.name}" saved successfully!`,
      });

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

      <CollectionBuilder onSave={handleSaveCollection} />
    </>
  );
}
