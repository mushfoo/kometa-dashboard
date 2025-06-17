import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { z } from 'zod';
import path from 'path';
import { promises as fs } from 'fs';

// Configuration schema for Kometa process
const KometaConfig = z.object({
  configPath: z.string(),
  verbosity: z.enum(['debug', 'info', 'warning', 'error']).default('info'),
  dryRun: z.boolean().default(false),
  libraries: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  operationType: z.enum(['full_run', 'collections_only', 'library_only', 'config_reload']).default('full_run'),
});

type KometaConfig = z.infer<typeof KometaConfig>;

// Process status enumeration
/* eslint-disable no-unused-vars */
export enum ProcessStatus {
  IDLE = 'idle',
  STARTING = 'starting', 
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  CRASHED = 'crashed',
  FAILED = 'failed'
}
/* eslint-enable no-unused-vars */

// Log output interface
export interface LogOutput {
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  source: 'stdout' | 'stderr';
  operationId?: string;
}

// Process information interface
export interface ProcessInfo {
  pid?: number;
  status: ProcessStatus;
  startTime?: Date;
  endTime?: Date;
  exitCode?: number;
  signal?: string;
  operationId: string;
  config: KometaConfig;
}

/**
 * KometaService manages Kometa subprocess operations with advanced process monitoring,
 * real-time log capture, and robust error handling.
 */
export class KometaService extends EventEmitter {
  private currentProcess: ChildProcess | null = null;
  private processInfo: ProcessInfo | null = null;
  private logBuffer: LogOutput[] = [];
  private readonly maxLogBuffer = 1000;

  constructor() {
    super();
    this.setMaxListeners(50); // Allow many listeners for real-time updates
  }

  /**
   * Start a new Kometa process with the given configuration
   */
  async startProcess(config: KometaConfig): Promise<string> {
    // Validate configuration
    const validatedConfig = KometaConfig.parse(config);
    
    // Ensure no process is currently running
    if (this.isRunning()) {
      throw new Error('A Kometa process is already running. Stop it before starting a new one.');
    }

    // Generate unique operation ID
    const operationId = `kometa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize process info
    this.processInfo = {
      status: ProcessStatus.STARTING,
      operationId,
      config: validatedConfig,
      startTime: new Date(),
    };

    try {
      // Verify config file exists
      await this.validateConfigFile(validatedConfig.configPath);

      // Spawn the Kometa process
      this.currentProcess = await this.spawnKometaProcess(validatedConfig, operationId);
      
      // Update process info with PID
      if (this.processInfo && this.currentProcess.pid) {
        this.processInfo.pid = this.currentProcess.pid;
        this.processInfo.status = ProcessStatus.RUNNING;
      }

      // Set up process monitoring
      this.setupProcessMonitoring(operationId);

      // Emit process started event
      this.emit('processStarted', {
        operationId,
        pid: this.currentProcess.pid,
        config: validatedConfig,
      });

      return operationId;
    } catch (error) {
      // Update status to failed
      if (this.processInfo) {
        this.processInfo.status = ProcessStatus.FAILED;
        this.processInfo.endTime = new Date();
      }

      this.emit('processError', {
        operationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Stop the currently running process
   */
  async stopProcess(force: boolean = false): Promise<boolean> {
    if (!this.currentProcess || !this.processInfo) {
      return false;
    }

    const { operationId } = this.processInfo;
    
    try {
      this.processInfo.status = ProcessStatus.STOPPING;
      
      // Send termination signal
      if (force) {
        this.currentProcess.kill('SIGKILL');
      } else {
        this.currentProcess.kill('SIGTERM');
        
        // If graceful shutdown takes too long, force kill after 10 seconds
        setTimeout(() => {
          if (this.currentProcess && !this.currentProcess.killed) {
            this.currentProcess.kill('SIGKILL');
          }
        }, 10000);
      }

      this.emit('processStopping', { operationId, force });
      return true;
    } catch (error) {
      this.emit('processError', {
        operationId,
        error: error instanceof Error ? error.message : 'Failed to stop process',
      });
      return false;
    }
  }

  /**
   * Get current process status and information
   */
  getProcessInfo(): ProcessInfo | null {
    return this.processInfo ? { ...this.processInfo } : null;
  }

  /**
   * Check if a process is currently running
   */
  isRunning(): boolean {
    return this.processInfo?.status === ProcessStatus.RUNNING;
  }

  /**
   * Get recent log entries (last N entries from buffer)
   */
  getRecentLogs(count: number = 100): LogOutput[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear the log buffer
   */
  clearLogBuffer(): void {
    this.logBuffer = [];
    this.emit('logBufferCleared');
  }

  /**
   * Validate that the config file exists and is readable
   */
  private async validateConfigFile(configPath: string): Promise<void> {
    try {
      await fs.access(configPath, fs.constants.R_OK);
    } catch {
      throw new Error(`Configuration file not found or not readable: ${configPath}`);
    }
  }

  /**
   * Spawn the actual Kometa process with proper error handling
   */
  private async spawnKometaProcess(config: KometaConfig, operationId: string): Promise<ChildProcess> {
    const args = this.buildKometaArgs(config);

    // Try different execution methods in order of preference
    const executionMethods = [
      // Docker execution (preferred)
      () => this.tryDockerExecution(args, config.configPath, operationId),
      // Local Kometa installation
      () => this.tryLocalExecution('kometa', args, operationId),
      // Python module execution
      () => this.tryLocalExecution('python', ['-m', 'kometa', ...args], operationId),
    ];

    let lastError: Error | null = null;

    for (const method of executionMethods) {
      try {
        const process = await method();
        if (process) {
          return process;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown execution error');
      }
    }

    throw new Error(`Failed to start Kometa process. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Try Docker execution method
   */
  private async tryDockerExecution(args: string[], configPath: string, operationId: string): Promise<ChildProcess> {
    const dockerArgs = [
      'run',
      '--rm',
      '-v', `${path.dirname(configPath)}:/config`,
      'kometateam/kometa',
      ...args,
    ];

    return spawn('docker', dockerArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        KOMETA_OPERATION_ID: operationId,
      },
    });
  }

  /**
   * Try local execution method
   */
  private async tryLocalExecution(command: string, args: string[], operationId: string): Promise<ChildProcess> {
    return spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        KOMETA_OPERATION_ID: operationId,
      },
    });
  }

  /**
   * Build command line arguments for Kometa
   */
  private buildKometaArgs(config: KometaConfig): string[] {
    const args = ['--config', config.configPath];

    // Add verbosity flag
    switch (config.verbosity) {
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
    if (config.dryRun) {
      args.push('--dry-run');
    }

    // Add operation-specific flags
    switch (config.operationType) {
      case 'collections_only':
        args.push('--collections-only');
        break;
      case 'library_only':
        if (config.libraries?.length) {
          args.push('--libraries', config.libraries.join(','));
        }
        break;
      case 'config_reload':
        args.push('--config-reload');
        break;
      // 'full_run' doesn't need additional flags
    }

    return args;
  }

  /**
   * Set up comprehensive process monitoring with event handlers
   */
  private setupProcessMonitoring(operationId: string): void {
    if (!this.currentProcess || !this.processInfo) return;

    const process = this.currentProcess;
    let stdoutBuffer = '';
    let stderrBuffer = '';

    // Monitor stdout with line buffering
    process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdoutBuffer += output;

      // Process complete lines
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || ''; // Keep incomplete line in buffer

      lines.forEach(line => {
        if (line.trim()) {
          const logEntry = this.parseLogLine(line, 'stdout', operationId);
          this.addToLogBuffer(logEntry);
          this.emit('logOutput', logEntry);
        }
      });
    });

    // Monitor stderr with line buffering
    process.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      stderrBuffer += output;

      // Process complete lines
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || ''; // Keep incomplete line in buffer

      lines.forEach(line => {
        if (line.trim()) {
          const logEntry = this.parseLogLine(line, 'stderr', operationId);
          this.addToLogBuffer(logEntry);
          this.emit('logOutput', logEntry);
        }
      });
    });

    // Handle process exit
    process.on('exit', (code, signal) => {
      if (!this.processInfo) return;

      this.processInfo.endTime = new Date();
      this.processInfo.exitCode = code || undefined;
      this.processInfo.signal = signal || undefined;

      if (signal) {
        this.processInfo.status = ProcessStatus.STOPPED;
      } else if (code === 0) {
        this.processInfo.status = ProcessStatus.STOPPED;
      } else {
        this.processInfo.status = ProcessStatus.FAILED;
      }

      this.emit('processExited', {
        operationId,
        exitCode: code,
        signal,
        status: this.processInfo.status,
      });

      // Clean up
      this.currentProcess = null;
    });

    // Handle process errors
    process.on('error', (error) => {
      if (this.processInfo) {
        this.processInfo.status = ProcessStatus.CRASHED;
        this.processInfo.endTime = new Date();
      }

      this.emit('processError', {
        operationId,
        error: error.message,
      });

      this.currentProcess = null;
    });

    // Monitor process health
    this.startHealthMonitoring(operationId);
  }

  /**
   * Parse log line and extract level information
   */
  private parseLogLine(line: string, source: 'stdout' | 'stderr', operationId: string): LogOutput {
    // Simple log level detection - can be enhanced based on Kometa's actual log format
    let level: LogOutput['level'] = 'INFO';
    
    if (line.includes('ERROR') || line.includes('Error')) {
      level = 'ERROR';
    } else if (line.includes('WARNING') || line.includes('Warning')) {
      level = 'WARNING';
    } else if (line.includes('DEBUG') || line.includes('Debug')) {
      level = 'DEBUG';
    }

    // Override level for stderr messages
    if (source === 'stderr' && level === 'INFO') {
      level = 'ERROR';
    }

    return {
      timestamp: new Date(),
      level,
      message: line.trim(),
      source,
      operationId,
    };
  }

  /**
   * Add log entry to circular buffer
   */
  private addToLogBuffer(logEntry: LogOutput): void {
    this.logBuffer.push(logEntry);
    
    // Maintain circular buffer size
    if (this.logBuffer.length > this.maxLogBuffer) {
      this.logBuffer.shift();
    }
  }

  /**
   * Start health monitoring for the process
   */
  private startHealthMonitoring(operationId: string): void {
    const healthCheckInterval = setInterval(() => {
      if (!this.currentProcess || !this.processInfo) {
        clearInterval(healthCheckInterval);
        return;
      }

      // Check if process is still alive
      try {
        process.kill(this.currentProcess.pid!, 0); // Signal 0 checks if process exists
      } catch {
        // Process no longer exists
        if (this.processInfo.status === ProcessStatus.RUNNING) {
          this.processInfo.status = ProcessStatus.CRASHED;
          this.processInfo.endTime = new Date();
          
          this.emit('processError', {
            operationId,
            error: 'Process appears to have crashed unexpectedly',
          });
        }
        
        clearInterval(healthCheckInterval);
        this.currentProcess = null;
      }
    }, 5000); // Check every 5 seconds
  }
}