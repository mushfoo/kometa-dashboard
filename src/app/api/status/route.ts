import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, logApiRequest } from '@/lib/api-utils';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

async function checkFileSystemAccess(): Promise<{
  accessible: boolean;
  directories: Record<string, boolean>;
}> {
  const storageDir = path.join(process.cwd(), 'storage');
  const requiredDirs = ['configs', 'settings', 'history', 'templates', 'keys'];

  const directories: Record<string, boolean> = {};
  let accessible = true;

  try {
    // Check if storage directory exists and is accessible
    await fs.access(storageDir);

    // Check each required subdirectory
    for (const dir of requiredDirs) {
      const dirPath = path.join(storageDir, dir);
      try {
        await fs.access(dirPath);
        directories[dir] = true;
      } catch {
        directories[dir] = false;
        accessible = false;
      }
    }
  } catch {
    accessible = false;
    // Mark all directories as inaccessible
    requiredDirs.forEach((dir) => {
      directories[dir] = false;
    });
  }

  return { accessible, directories };
}

async function checkKometaAvailability(): Promise<{
  available: boolean;
  method?: 'docker' | 'path';
  version?: string;
  error?: string;
}> {
  // First check for Docker
  try {
    const { stdout } = await execAsync('docker --version');
    if (stdout.includes('Docker version')) {
      try {
        // Check if Kometa Docker image is available locally
        await execAsync(
          'docker images --format "{{.Repository}}" | grep -q "kometateam/kometa"'
        );
        return {
          available: true,
          method: 'docker',
          version: 'Docker image available',
        };
      } catch {
        // Docker available but no Kometa image
        return {
          available: false,
          method: 'docker',
          error: 'Docker available but Kometa image not found',
        };
      }
    }
  } catch (dockerError) {
    // Docker not available, check PATH
    try {
      const { stdout } = await execAsync(
        'which kometa || which python -m kometa'
      );
      if (stdout.trim()) {
        try {
          const { stdout: versionOutput } = await execAsync(
            'kometa --version || python -m kometa --version'
          );
          return {
            available: true,
            method: 'path',
            version: versionOutput.trim(),
          };
        } catch {
          return {
            available: true,
            method: 'path',
            version: 'Available in PATH',
          };
        }
      }
    } catch (pathError) {
      return {
        available: false,
        error: 'Kometa not found in Docker or PATH',
      };
    }
  }

  return {
    available: false,
    error: 'Unable to determine Kometa availability',
  };
}

async function checkPlexConfiguration(): Promise<
  | {
      configured: boolean;
      reachable?: boolean;
      error?: string;
    }
  | undefined
> {
  try {
    // Check if Plex configuration exists
    const configPath = path.join(
      process.cwd(),
      'storage',
      'settings',
      'settings.json'
    );
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    if (config.plex?.url && config.plex?.token) {
      // TODO: In a real implementation, we would make an HTTP request to the Plex server
      // For now, we'll just return that it's configured
      return {
        configured: true,
        reachable: true, // Placeholder - would need actual HTTP check
      };
    }

    return { configured: false };
  } catch {
    // Configuration file doesn't exist or is invalid
    return { configured: false };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Perform all health checks
    const [storage, kometa, plex] = await Promise.all([
      checkFileSystemAccess(),
      checkKometaAvailability(),
      checkPlexConfiguration(),
    ]);

    // Determine overall system status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!storage.accessible || !kometa.available) {
      status = 'unhealthy';
    } else if (plex?.configured && !plex.reachable) {
      status = 'degraded';
    }

    const systemStatus: SystemStatus = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      storage,
      kometa,
      ...(plex && { plex }),
    };

    logApiRequest(request, startTime);
    return NextResponse.json(systemStatus);
  } catch (error) {
    return createErrorResponse(error, 'Failed to get system status');
  }
}
