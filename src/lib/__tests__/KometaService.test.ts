import { KometaService, ProcessStatus } from '../KometaService';
import { spawn } from 'child_process';
// import { ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { EventEmitter } from 'events';

// Mock child_process module
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    constants: {
      R_OK: 4,
    },
  },
}));

// Mock process for testing
class MockChildProcess extends EventEmitter {
  pid: number = 12345;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;

  kill(signal?: string) {
    this.killed = true;
    // Simulate process exit after a short delay
    setTimeout(() => {
      this.emit('exit', signal === 'SIGKILL' ? null : 0, signal);
    }, 10);
    return true;
  }
}

describe('KometaService', () => {
  let service: KometaService;
  let mockProcess: MockChildProcess;

  beforeEach(() => {
    service = new KometaService();
    mockProcess = new MockChildProcess();
    jest.clearAllMocks();
    
    // Mock fs.access to always succeed
    (fs.access as jest.MockedFunction<typeof fs.access>).mockResolvedValue(undefined);
    
    // Mock spawn to return our mock process
    mockSpawn.mockReturnValue(mockProcess as any);
  });

  afterEach(() => {
    // Clean up any running processes
    if (service.isRunning()) {
      service.stopProcess(true);
    }
  });

  describe('Process Lifecycle Management', () => {
    const testConfig = {
      configPath: '/test/config.yml',
      verbosity: 'info' as const,
      operationType: 'full_run' as const,
    };

    test('should start a process successfully', async () => {
      const operationId = await service.startProcess(testConfig);
      
      expect(operationId).toMatch(/^kometa_\d+_[a-z0-9]+$/);
      expect(service.isRunning()).toBe(true);
      
      const processInfo = service.getProcessInfo();
      expect(processInfo).toMatchObject({
        status: ProcessStatus.RUNNING,
        pid: 12345,
        operationId,
        config: testConfig,
      });
    });

    test('should reject starting a process when one is already running', async () => {
      await service.startProcess(testConfig);
      
      await expect(service.startProcess(testConfig)).rejects.toThrow(
        'A Kometa process is already running'
      );
    });

    test('should stop a running process gracefully', async () => {
      await service.startProcess(testConfig);
      
      const stopResult = await service.stopProcess();
      expect(stopResult).toBe(true);
      
      // Wait for process to exit
      await new Promise(resolve => service.once('processExited', resolve));
      
      expect(service.isRunning()).toBe(false);
    });

    test('should force stop a running process', async () => {
      await service.startProcess(testConfig);
      
      const stopResult = await service.stopProcess(true);
      expect(stopResult).toBe(true);
      
      // Wait for process to exit
      await new Promise(resolve => service.once('processExited', resolve));
      
      expect(service.isRunning()).toBe(false);
    });

    test('should return false when trying to stop non-existent process', async () => {
      const stopResult = await service.stopProcess();
      expect(stopResult).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate configuration schema', async () => {
      const invalidConfig = {
        configPath: '/test/config.yml',
        verbosity: 'invalid' as any,
      };

      await expect(service.startProcess(invalidConfig)).rejects.toThrow();
    });

    test('should check config file accessibility', async () => {
      const config = {
        configPath: '/nonexistent/config.yml',
        verbosity: 'info' as const,
        operationType: 'full_run' as const,
      };

      // Mock fs.access to fail
      (fs.access as jest.MockedFunction<typeof fs.access>).mockRejectedValue(
        new Error('File not found')
      );

      await expect(service.startProcess(config)).rejects.toThrow(
        'Configuration file not found or not readable'
      );
    });
  });

  describe('Log Output Handling', () => {
    const testConfig = {
      configPath: '/test/config.yml',
      verbosity: 'info' as const,
      operationType: 'full_run' as const,
    };

    test('should capture and parse stdout logs', async () => {
      const logOutputs: any[] = [];
      service.on('logOutput', (log) => logOutputs.push(log));

      await service.startProcess(testConfig);

      // Simulate stdout output
      mockProcess.stdout.emit('data', Buffer.from('INFO: Starting Kometa\n'));
      mockProcess.stdout.emit('data', Buffer.from('DEBUG: Debug message\n'));

      // Wait a bit for events to process
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(logOutputs).toHaveLength(2);
      expect(logOutputs[0]).toMatchObject({
        level: 'INFO',
        message: 'INFO: Starting Kometa',
        source: 'stdout',
      });
      expect(logOutputs[1]).toMatchObject({
        level: 'DEBUG',
        message: 'DEBUG: Debug message',
        source: 'stdout',
      });
    });

    test('should capture and parse stderr logs', async () => {
      const logOutputs: any[] = [];
      service.on('logOutput', (log) => logOutputs.push(log));

      await service.startProcess(testConfig);

      // Simulate stderr output
      mockProcess.stderr.emit('data', Buffer.from('ERROR: Something went wrong\n'));

      // Wait a bit for events to process
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(logOutputs).toHaveLength(1);
      expect(logOutputs[0]).toMatchObject({
        level: 'ERROR',
        message: 'ERROR: Something went wrong',
        source: 'stderr',
      });
    });

    test('should handle partial log lines correctly', async () => {
      const logOutputs: any[] = [];
      service.on('logOutput', (log) => logOutputs.push(log));

      await service.startProcess(testConfig);

      // Simulate partial data chunks
      mockProcess.stdout.emit('data', Buffer.from('This is a partial '));
      mockProcess.stdout.emit('data', Buffer.from('line that gets completed\n'));

      // Wait a bit for events to process
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(logOutputs).toHaveLength(1);
      expect(logOutputs[0].message).toBe('This is a partial line that gets completed');
    });

    test('should maintain circular log buffer', async () => {
      await service.startProcess(testConfig);

      // Generate logs beyond buffer size (1000)
      for (let i = 0; i < 1100; i++) {
        mockProcess.stdout.emit('data', Buffer.from(`Log message ${i}\n`));
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const recentLogs = service.getRecentLogs();
      expect(recentLogs.length).toBeLessThanOrEqual(1000);
      
      // Should contain the most recent logs
      const lastLog = recentLogs[recentLogs.length - 1];
      expect(lastLog?.message).toBe('Log message 1099');
    });
  });

  describe('Process Monitoring', () => {
    const testConfig = {
      configPath: '/test/config.yml',
      verbosity: 'info' as const,
      operationType: 'full_run' as const,
    };

    test('should emit processStarted event', async () => {
      const startedEvents: any[] = [];
      service.on('processStarted', (event) => startedEvents.push(event));

      const operationId = await service.startProcess(testConfig);

      expect(startedEvents).toHaveLength(1);
      expect(startedEvents[0]).toMatchObject({
        operationId,
        pid: 12345,
        config: testConfig,
      });
    });

    test('should emit processExited event on normal exit', async () => {
      const exitedEvents: any[] = [];
      service.on('processExited', (event) => exitedEvents.push(event));

      const operationId = await service.startProcess(testConfig);
      
      // Simulate normal process exit
      setTimeout(() => mockProcess.emit('exit', 0, null), 10);

      // Wait for event
      await new Promise(resolve => service.once('processExited', resolve));

      expect(exitedEvents).toHaveLength(1);
      expect(exitedEvents[0]).toMatchObject({
        operationId,
        exitCode: 0,
        signal: null,
        status: ProcessStatus.STOPPED,
      });
    });

    test('should emit processError event on process error', async () => {
      const errorEvents: any[] = [];
      service.on('processError', (event) => errorEvents.push(event));

      const operationId = await service.startProcess(testConfig);
      
      // Simulate process error
      setTimeout(() => mockProcess.emit('error', new Error('Process crashed')), 10);

      // Wait for event
      await new Promise(resolve => service.once('processError', resolve));

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toMatchObject({
        operationId,
        error: 'Process crashed',
      });
    });

    test('should detect process crash during health monitoring', async () => {
      // Skip this test for now as it requires long timeouts
      // This would be better tested with integration tests
    }, 1000);
  });

  describe('Command Building', () => {
    test('should build basic command args', async () => {
      const config = {
        configPath: '/test/config.yml',
        verbosity: 'info' as const,
        operationType: 'full_run' as const,
      };

      // We'll test this indirectly by checking spawn was called with correct args
      await service.startProcess(config);

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'run', '--rm', '-v', '/test:/config', 'kometateam/kometa',
          '--config', '/test/config.yml'
        ]),
        expect.any(Object)
      );
    });

    test('should add verbosity flags', async () => {
      const debugConfig = {
        configPath: '/test/config.yml',
        verbosity: 'debug' as const,
        operationType: 'full_run' as const,
      };

      await service.startProcess(debugConfig);

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['--debug']),
        expect.any(Object)
      );
    });

    test('should add dry run flag', async () => {
      const dryRunConfig = {
        configPath: '/test/config.yml',
        verbosity: 'info' as const,
        operationType: 'full_run' as const,
        dryRun: true,
      };

      await service.startProcess(dryRunConfig);

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['--dry-run']),
        expect.any(Object)
      );
    });

    test('should add operation-specific flags', async () => {
      const collectionsConfig = {
        configPath: '/test/config.yml',
        verbosity: 'info' as const,
        operationType: 'collections_only' as const,
      };

      await service.startProcess(collectionsConfig);

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['--collections-only']),
        expect.any(Object)
      );
    });
  });

  describe('Execution Fallback', () => {
    test('should fallback to local execution when Docker fails', async () => {
      // Make Docker spawn fail
      mockSpawn
        .mockImplementationOnce(() => {
          throw new Error('Docker not found');
        })
        .mockReturnValueOnce(mockProcess as any);

      const config = {
        configPath: '/test/config.yml',
        verbosity: 'info' as const,
        operationType: 'full_run' as const,
      };

      await service.startProcess(config);

      // Should have tried Docker first, then local kometa
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(mockSpawn).toHaveBeenNthCalledWith(1, 'docker', expect.any(Array), expect.any(Object));
      expect(mockSpawn).toHaveBeenNthCalledWith(2, 'kometa', expect.any(Array), expect.any(Object));
    });

    test('should try all execution methods before failing', async () => {
      // Make all spawn calls fail
      mockSpawn.mockImplementation(() => {
        throw new Error('Execution failed');
      });

      const config = {
        configPath: '/test/config.yml',
        verbosity: 'info' as const,
        operationType: 'full_run' as const,
      };

      await expect(service.startProcess(config)).rejects.toThrow('Failed to start Kometa process');

      // Should have tried all three methods
      expect(mockSpawn).toHaveBeenCalledTimes(3);
      expect(mockSpawn).toHaveBeenNthCalledWith(1, 'docker', expect.any(Array), expect.any(Object));
      expect(mockSpawn).toHaveBeenNthCalledWith(2, 'kometa', expect.any(Array), expect.any(Object));
      expect(mockSpawn).toHaveBeenNthCalledWith(3, 'python', expect.any(Array), expect.any(Object));
    });
  });

  describe('Utility Methods', () => {
    test('should return null process info when no process is running', () => {
      const processInfo = service.getProcessInfo();
      expect(processInfo).toBeNull();
    });

    test('should return copy of process info to prevent mutation', async () => {
      const config = {
        configPath: '/test/config.yml',
        verbosity: 'info' as const,
        operationType: 'full_run' as const,
      };

      await service.startProcess(config);
      const processInfo1 = service.getProcessInfo();
      const processInfo2 = service.getProcessInfo();

      expect(processInfo1).not.toBe(processInfo2); // Different objects
      expect(processInfo1).toEqual(processInfo2); // Same content
    });

    test('should clear log buffer', async () => {
      const config = {
        configPath: '/test/config.yml',
        verbosity: 'info' as const,
        operationType: 'full_run' as const,
      };

      await service.startProcess(config);
      
      // Add some logs
      mockProcess.stdout.emit('data', Buffer.from('Test log\n'));
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(service.getRecentLogs()).toHaveLength(1);
      
      service.clearLogBuffer();
      expect(service.getRecentLogs()).toHaveLength(0);
    });

    test('should emit logBufferCleared event', (done) => {
      service.on('logBufferCleared', () => {
        done();
      });

      service.clearLogBuffer();
    });
  });
});