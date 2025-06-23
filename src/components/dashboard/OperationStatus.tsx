'use client';

import { useSSE } from '@/hooks/useSSE';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play,
  Square,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Activity,
} from 'lucide-react';
import { useState } from 'react';

interface OperationStatusProps {
  className?: string;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'idle':
      return <Clock className="w-5 h-5 text-gray-500" />;
    case 'starting':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case 'running':
      return <Activity className="w-5 h-5 text-green-500 animate-pulse" />;
    case 'stopping':
      return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
    case 'stopped':
      return <Square className="w-5 h-5 text-gray-500" />;
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'failed':
    case 'crashed':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Clock className="w-5 h-5 text-gray-500" />;
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'starting':
      return 'Starting...';
    case 'running':
      return 'Running';
    case 'stopping':
      return 'Stopping...';
    case 'stopped':
      return 'Stopped';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'crashed':
      return 'Crashed';
    default:
      return 'Unknown';
  }
}

export function OperationStatus({ className }: OperationStatusProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const { data, isConnected, error } = useSSE({
    type: 'status',
    enabled: true,
  });

  const currentStatus = data.status?.processStatus || 'idle';
  const isRunning = currentStatus === 'running' || currentStatus === 'starting';
  const canStart =
    currentStatus === 'idle' ||
    currentStatus === 'stopped' ||
    currentStatus === 'failed' ||
    currentStatus === 'crashed';
  const canStop = currentStatus === 'running' || currentStatus === 'starting';

  const handleStart = async () => {
    setIsStarting(true);
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
    } catch (error) {
      console.error('Failed to start operation:', error);
      alert(
        `Failed to start operation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      const response = await fetch('/api/operations/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to stop operation');
      }
    } catch (error) {
      console.error('Failed to stop operation:', error);
      alert(
        `Failed to stop operation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Current Operation</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-xs text-gray-500">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            Connection error: {error}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Status Display */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <StatusIcon status={currentStatus} />
          <div className="flex-1">
            <p className="font-medium">{formatStatus(currentStatus)}</p>
            {data.status?.operationId && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ID: {data.status.operationId}
              </p>
            )}
          </div>
        </div>

        {/* Progress Information */}
        {isRunning && (
          <div className="space-y-3">
            {data.status?.progress !== undefined && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>{Math.round(data.status.progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${data.status.progress}%` }}
                  />
                </div>
              </div>
            )}

            {data.status?.currentCollection && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Current Collection:</strong>{' '}
                  {data.status.currentCollection}
                </p>
              </div>
            )}

            {data.status?.eta && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Estimated Time Remaining:</strong> {data.status.eta}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleStart}
            disabled={!canStart || isStarting}
            className="flex-1"
            variant={canStart ? 'default' : 'outline'}
          >
            {isStarting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {isStarting ? 'Starting...' : 'Start Operation'}
          </Button>

          <Button
            onClick={handleStop}
            disabled={!canStop || isStopping}
            variant="destructive"
            className="flex-1"
          >
            {isStopping ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Square className="w-4 h-4 mr-2" />
            )}
            {isStopping ? 'Stopping...' : 'Stop Operation'}
          </Button>
        </div>

        {/* Status Messages */}
        {currentStatus === 'idle' && (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            No operation is currently running. Click &quot;Start Operation&quot;
            to begin.
          </p>
        )}

        {currentStatus === 'failed' && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              The last operation failed. Check the logs for more details.
            </p>
          </div>
        )}

        {currentStatus === 'crashed' && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              The Kometa process crashed unexpectedly. Check the logs for more
              details.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
