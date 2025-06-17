import { OperationHistoryService } from './OperationHistoryService';
import { z } from 'zod';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

// Request body schema for starting operations
const StartOperationRequest = z.object({
  type: z.enum([
    'full_run',
    'collections_only',
    'library_only',
    'config_reload',
  ]),
  parameters: z
    .object({
      libraries: z.array(z.string()).optional(),
      collections: z.array(z.string()).optional(),
      dryRun: z.boolean().default(false),
      verbosity: z.enum(['debug', 'info', 'warning', 'error']).default('info'),
    })
    .default({}),
});

type StartOperationRequest = z.infer<typeof StartOperationRequest>;

// Global state for tracking running operations
// In a production environment, this would be stored in Redis or similar
const runningOperations = new Map<
  string,
  {
    process: ChildProcess;
    operationId: string;
    startTime: Date;
    type: string;
  }
>();

class KometaOperationService {
  private historyService: OperationHistoryService;

  constructor() {
    this.historyService = new OperationHistoryService();
  }

  async startOperation(request: StartOperationRequest): Promise<string> {
    // Check if another operation is already running
    if (runningOperations.size > 0) {
      throw new Error(
        'Another operation is already running. Please wait for it to complete.'
      );
    }

    // Add operation to history
    const operationId = await this.historyService.addOperation({
      type: request.type,
      status: 'queued',
      startTime: new Date().toISOString(),
      parameters: request.parameters,
    });

    try {
      // Start the Kometa process
      const childProcess = await this.spawnKometaProcess(request, operationId);

      // Track the running operation
      runningOperations.set(operationId, {
        process: childProcess,
        operationId,
        startTime: new Date(),
        type: request.type,
      });

      // Update status to running
      await this.historyService.updateOperation(operationId, {
        status: 'running',
        startTime: new Date().toISOString(),
      });

      // Set up process event handlers
      this.setupProcessHandlers(childProcess, operationId);

      return operationId;
    } catch (error) {
      // Update operation status to failed
      await this.historyService.updateOperation(operationId, {
        status: 'failed',
        endTime: new Date().toISOString(),
        results: {
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      });
      throw error;
    }
  }

  private async spawnKometaProcess(
    request: StartOperationRequest,
    operationId: string
  ): Promise<ChildProcess> {
    const configPath = path.join(process.cwd(), 'storage', 'config.yml');

    // Check if config file exists
    try {
      await fs.access(configPath);
    } catch {
      throw new Error(
        'Configuration file not found. Please configure Kometa first.'
      );
    }

    // Build Kometa command arguments
    const args = this.buildKometaArgs(request, configPath);

    // Try Docker first, then fallback to local installation
    let childProcess: ChildProcess;

    try {
      // Attempt Docker execution
      const dockerArgs = [
        'run',
        '--rm',
        '-v',
        `${path.dirname(configPath)}:/config`,
        'kometateam/kometa',
        ...args,
      ];

      childProcess = spawn('docker', dockerArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          KOMETA_OPERATION_ID: operationId,
        },
      });
    } catch {
      // Fallback to local installation
      try {
        childProcess = spawn('kometa', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            KOMETA_OPERATION_ID: operationId,
          },
        });
      } catch {
        // Final fallback to Python module
        childProcess = spawn('python', ['-m', 'kometa', ...args], {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            KOMETA_OPERATION_ID: operationId,
          },
        });
      }
    }

    return childProcess;
  }

  private buildKometaArgs(
    request: StartOperationRequest,
    configPath: string
  ): string[] {
    const args = ['--config', configPath];

    // Add verbosity flag
    switch (request.parameters.verbosity) {
      case 'debug':
        args.push('--debug');
        break;
      case 'warning':
        args.push('--warning');
        break;
      case 'error':
        args.push('--error');
        break;
      default:
        // 'info' is default, no flag needed
        break;
    }

    // Add dry run flag
    if (request.parameters.dryRun) {
      args.push('--dry-run');
    }

    // Add operation-specific flags
    switch (request.type) {
      case 'collections_only':
        args.push('--collections-only');
        break;
      case 'library_only':
        if (request.parameters.libraries?.length) {
          args.push('--libraries', request.parameters.libraries.join(','));
        }
        break;
      case 'config_reload':
        args.push('--config-reload');
        break;
      // 'full_run' doesn't need additional flags
    }

    return args;
  }

  private setupProcessHandlers(
    childProcess: ChildProcess,
    operationId: string
  ): void {
    let stderrBuffer = '';

    // Handle stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      // TODO: Parse logs and update progress in real-time
      // This would involve parsing Kometa's output format
      console.log('Kometa output:', data.toString());
    });

    // Handle stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      stderrBuffer += data.toString();
    });

    // Handle process completion
    childProcess.on('exit', async (code, signal) => {
      const operation = runningOperations.get(operationId);
      if (!operation) return;

      const endTime = new Date();
      const duration = endTime.getTime() - operation.startTime.getTime();

      let status: 'completed' | 'failed' | 'cancelled' = 'completed';
      const errors: string[] = [];

      if (signal) {
        status = 'cancelled';
        errors.push(`Process terminated with signal: ${signal}`);
      } else if (code !== 0) {
        status = 'failed';
        errors.push(`Process exited with code: ${code}`);
        if (stderrBuffer) {
          errors.push(stderrBuffer);
        }
      }

      // Update operation history
      await this.historyService.updateOperation(operationId, {
        status,
        endTime: endTime.toISOString(),
        duration,
        results: {
          errors: errors.length > 0 ? errors : undefined,
          // TODO: Parse actual results from stdout
        },
      });

      // Remove from running operations
      runningOperations.delete(operationId);
    });

    // Handle process errors
    childProcess.on('error', async (error) => {
      await this.historyService.updateOperation(operationId, {
        status: 'failed',
        endTime: new Date().toISOString(),
        results: {
          errors: [error.message],
        },
      });

      runningOperations.delete(operationId);
    });
  }

  getCurrentOperation(): {
    operationId: string;
    type: string;
    startTime: Date;
  } | null {
    const operations = Array.from(runningOperations.values());
    if (operations.length === 0) return null;

    const operation = operations[0]; // Should only be one
    if (!operation) return null;

    return {
      operationId: operation.operationId,
      type: operation.type,
      startTime: operation.startTime,
    };
  }

  async stopOperation(
    operationId: string,
    force: boolean = false
  ): Promise<boolean> {
    const operation = runningOperations.get(operationId);
    if (!operation) {
      return false;
    }

    try {
      if (force) {
        operation.process.kill('SIGKILL');
      } else {
        operation.process.kill('SIGTERM');
      }
      return true;
    } catch {
      return false;
    }
  }
}

export { KometaOperationService, StartOperationRequest };
export type { StartOperationRequest as StartOperationRequestType };
