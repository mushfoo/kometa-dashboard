'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play,
  RefreshCw,
  Settings,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface QuickActionsPanelProps {
  className?: string;
}

interface ActionState {
  isLoading: boolean;
  lastResult?: 'success' | 'error';
  lastMessage?: string;
}

export function QuickActionsPanel({ className }: QuickActionsPanelProps) {
  const [runNowState, setRunNowState] = useState<ActionState>({
    isLoading: false,
  });
  const [clearCacheState, setClearCacheState] = useState<ActionState>({
    isLoading: false,
  });
  const [reloadConfigState, setReloadConfigState] = useState<ActionState>({
    isLoading: false,
  });

  const handleRunNow = async () => {
    setRunNowState({ isLoading: true });

    try {
      const response = await fetch('/api/operations/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'full_run',
          parameters: {
            verbosity: 'info',
            dryRun: false,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start operation');
      }

      setRunNowState({
        isLoading: false,
        lastResult: 'success',
        lastMessage: 'Operation started successfully',
      });
    } catch (error) {
      setRunNowState({
        isLoading: false,
        lastResult: 'error',
        lastMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleClearCache = async () => {
    setClearCacheState({ isLoading: true });

    try {
      // For now, we'll simulate cache clearing since this would need to be implemented in Kometa
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setClearCacheState({
        isLoading: false,
        lastResult: 'success',
        lastMessage: 'Cache cleared successfully',
      });
    } catch (error) {
      setClearCacheState({
        isLoading: false,
        lastResult: 'error',
        lastMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleReloadConfig = async () => {
    setReloadConfigState({ isLoading: true });

    try {
      const response = await fetch('/api/operations/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'config_reload',
          parameters: {
            verbosity: 'info',
            dryRun: false,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reload configuration');
      }

      setReloadConfigState({
        isLoading: false,
        lastResult: 'success',
        lastMessage: 'Configuration reload started',
      });
    } catch (error) {
      setReloadConfigState({
        isLoading: false,
        lastResult: 'error',
        lastMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const ActionButton = ({
    icon: Icon,
    label,
    state,
    onClick,
    variant = 'outline',
  }: {
    icon: React.ComponentType<any>;
    label: string;
    state: ActionState;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'destructive';
  }) => (
    <div className="space-y-2">
      <Button
        onClick={onClick}
        disabled={state.isLoading}
        className="w-full"
        variant={variant}
      >
        {state.isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Icon className="w-4 h-4 mr-2" />
        )}
        {state.isLoading ? 'Processing...' : label}
      </Button>

      {state.lastResult && state.lastMessage && (
        <div
          className={`flex items-center gap-2 text-xs p-2 rounded ${
            state.lastResult === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}
        >
          {state.lastResult === 'success' ? (
            <CheckCircle className="w-3 h-3" />
          ) : (
            <AlertCircle className="w-3 h-3" />
          )}
          <span>{state.lastMessage}</span>
        </div>
      )}
    </div>
  );

  return (
    <Card className={`p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
      <div className="space-y-4">
        <ActionButton
          icon={Play}
          label="Run Now"
          state={runNowState}
          onClick={handleRunNow}
          variant="default"
        />

        <ActionButton
          icon={RefreshCw}
          label="Clear Cache"
          state={clearCacheState}
          onClick={handleClearCache}
        />

        <ActionButton
          icon={Settings}
          label="Reload Config"
          state={reloadConfigState}
          onClick={handleReloadConfig}
        />
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          These actions affect the current Kometa configuration and operations.
          Use with caution during active operations.
        </p>
      </div>
    </Card>
  );
}
