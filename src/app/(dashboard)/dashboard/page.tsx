'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  Server,
  Database,
} from 'lucide-react';
import { OperationStatus } from '@/components/dashboard/OperationStatus';
import { QuickActionsPanel } from '@/components/dashboard/QuickActionsPanel';

interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  version: string;
  storage: {
    accessible: boolean;
    directories: Record<string, boolean>;
  };
  kometa: {
    available: boolean;
    method?: 'docker' | 'path';
    version?: string;
    error?: string;
  };
  plex?: {
    configured: boolean;
    reachable?: boolean;
    error?: string;
  };
}

interface Operation {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration?: number;
  progress?: number;
}

async function fetchSystemStatus(): Promise<SystemStatus> {
  const response = await fetch('/api/status');
  if (!response.ok) {
    throw new Error('Failed to fetch system status');
  }
  return response.json();
}

async function fetchRecentOperations(): Promise<Operation[]> {
  const response = await fetch('/api/operations?limit=5');
  if (!response.ok) {
    throw new Error('Failed to fetch operations');
  }
  const data = await response.json();
  return data.operations || [];
}

function StatusIcon({
  status,
}: {
  status: 'healthy' | 'degraded' | 'unhealthy';
}) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'degraded':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    case 'unhealthy':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatMemory(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

export default function DashboardPage() {
  const {
    data: systemStatus,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: ['system-status'],
    queryFn: fetchSystemStatus,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: operations, isLoading: operationsLoading } = useQuery({
    queryKey: ['recent-operations'],
    queryFn: fetchRecentOperations,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600 dark:text-red-400">
          Failed to load dashboard
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <StatusIcon status={systemStatus?.status || 'unhealthy'} />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Last updated:{' '}
            {systemStatus
              ? new Date(systemStatus.timestamp).toLocaleTimeString()
              : 'Never'}
          </span>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Server className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                System Status
              </p>
              <p className="text-lg font-semibold capitalize">
                {systemStatus?.status || 'Unknown'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Uptime</p>
              <p className="text-lg font-semibold">
                {systemStatus ? formatUptime(systemStatus.uptime) : 'Unknown'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Memory Usage
              </p>
              <p className="text-lg font-semibold">
                {systemStatus
                  ? formatMemory(systemStatus.memory.heapUsed)
                  : 'Unknown'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Storage
              </p>
              <p className="text-lg font-semibold">
                {systemStatus?.storage.accessible
                  ? 'Accessible'
                  : 'Unavailable'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Operation Status */}
        <OperationStatus className="lg:col-span-2" />

        {/* Quick Actions Panel */}
        <QuickActionsPanel />

        {/* Recent Operations */}
        <Card className="lg:col-span-3 p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Operations</h2>
          {operationsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : operations && operations.length > 0 ? (
            <div className="space-y-3">
              {operations.map((operation) => (
                <div
                  key={operation.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        operation.status === 'completed'
                          ? 'bg-green-500'
                          : operation.status === 'running'
                            ? 'bg-blue-500'
                            : operation.status === 'failed'
                              ? 'bg-red-500'
                              : 'bg-gray-500'
                      }`}
                    />
                    <div>
                      <p className="font-medium">{operation.type}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(operation.startTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-medium capitalize">
                    {operation.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">
              No recent operations found.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
