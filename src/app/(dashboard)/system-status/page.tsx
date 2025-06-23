'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  HardDrive,
  Server,
  Settings,
  Clock,
} from 'lucide-react';

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

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setStatus(data);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusIcon = (isHealthy: boolean) => {
    return isHealthy ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400';
      case 'degraded':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'unhealthy':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">System Status</h1>
          <Button disabled>
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Checking...
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">System Status</h1>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Unable to fetch system status. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">System Status</h1>
        <div className="flex items-center gap-4">
          {lastChecked && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchStatus} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Overall System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div
              className={`text-2xl font-bold ${getStatusColor(status.status)}`}
            >
              {status.status.toUpperCase()}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              Last updated: {new Date(status.timestamp).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              System Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Node.js Version:</span>
              <span className="font-mono">{status.version}</span>
            </div>
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span>{formatUptime(status.uptime)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Component Status */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {/* Storage Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              File Storage
              {getStatusIcon(status.storage.accessible)}
            </CardTitle>
            <CardDescription>
              Application data storage and directory access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(status.storage.directories).map(
                ([dir, accessible]) => (
                  <div key={dir} className="flex items-center justify-between">
                    <span className="capitalize">{dir}</span>
                    {getStatusIcon(accessible)}
                  </div>
                )
              )}
              {!status.storage.accessible && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Storage directories are not accessible.</strong>
                    <br />
                    This usually means the application doesn&apos;t have proper
                    file system permissions.
                    <br />
                    <strong>To fix:</strong> Ensure the application has
                    read/write access to the storage directory.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Kometa Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Kometa Engine
              {getStatusIcon(status.kometa.available)}
            </CardTitle>
            <CardDescription>
              Kometa automation engine availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {status.kometa.available ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Method:</span>
                    <span className="capitalize">{status.kometa.method}</span>
                  </div>
                  {status.kometa.version && (
                    <div className="flex justify-between">
                      <span>Version:</span>
                      <span className="font-mono text-sm">
                        {status.kometa.version}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Kometa is not available.</strong>
                    <br />
                    {status.kometa.error}
                    <br />
                    <strong>To fix:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>
                        Install Docker and pull the Kometa image:{' '}
                        <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                          docker pull kometateam/kometa
                        </code>
                      </li>
                      <li>Or install Kometa directly in your PATH</li>
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      asChild
                    >
                      <a
                        href="https://kometa.wiki/en/latest/install/docker/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Installation Guide{' '}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plex Status */}
        {status.plex && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Plex Media Server
                {getStatusIcon(
                  status.plex.configured && (status.plex.reachable ?? true)
                )}
              </CardTitle>
              <CardDescription>
                Connection to your Plex Media Server
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Configured:</span>
                  {getStatusIcon(status.plex.configured)}
                </div>
                {status.plex.configured &&
                  status.plex.reachable !== undefined && (
                    <div className="flex justify-between">
                      <span>Reachable:</span>
                      {getStatusIcon(status.plex.reachable)}
                    </div>
                  )}
                {!status.plex.configured && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Plex server is not configured. Configure your Plex
                      connection in the settings.
                    </AlertDescription>
                  </Alert>
                )}
                {status.plex.error && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{status.plex.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
