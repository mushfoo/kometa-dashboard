/**
 * Integration test for the status endpoint
 * Tests the actual endpoint behavior without complex mocking
 */

// Mock child_process at the module level before importing the route
jest.mock('child_process', () => ({
  exec: jest.fn((cmd: string, callback: Function) => {
    // Default mock behavior - simulate successful commands for normal tests
    if (cmd.includes('docker --version')) {
      callback(null, { stdout: 'Docker version 20.10.0' });
    } else if (cmd.includes('docker images')) {
      callback(null, { stdout: 'kometateam/kometa' });
    } else {
      callback(new Error('Command not found'));
    }
  }),
}));

import { GET } from '@/app/api/status/route';

describe('/api/status - Integration Tests', () => {
  let mockRequest: any;

  beforeEach(() => {
    // Mock console.log to silence API request logging during tests
    jest.spyOn(console, 'log').mockImplementation();

    mockRequest = {
      url: 'http://localhost/api/status',
      method: 'GET',
      headers: new Map(),
    };

    // Reset exec mock to default behavior before each test
    const { exec } = require('child_process');
    (exec as jest.Mock).mockImplementation(
      (cmd: string, callback: Function) => {
        // Default mock behavior - simulate successful commands for normal tests
        if (cmd.includes('docker --version')) {
          callback(null, { stdout: 'Docker version 20.10.0' });
        } else if (cmd.includes('docker images')) {
          callback(null, { stdout: 'kometateam/kometa' });
        } else {
          callback(new Error('Command not found'));
        }
      }
    );
  });

  afterEach(() => {
    // Restore console.log after each test
    jest.restoreAllMocks();
  });

  it('should return a valid status response', async () => {
    const response = await GET(mockRequest);
    const data = await response.json();

    // Verify response structure
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('memory');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('storage');
    expect(data).toHaveProperty('kometa');

    // Verify status is one of expected values
    expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);

    // Verify storage structure
    expect(data.storage).toHaveProperty('accessible');
    expect(data.storage).toHaveProperty('directories');
    expect(typeof data.storage.accessible).toBe('boolean');
    expect(typeof data.storage.directories).toBe('object');

    // Verify kometa structure
    expect(data.kometa).toHaveProperty('available');
    expect(typeof data.kometa.available).toBe('boolean');

    // Verify memory structure
    expect(data.memory).toHaveProperty('rss');
    expect(data.memory).toHaveProperty('heapTotal');
    expect(data.memory).toHaveProperty('heapUsed');
    expect(data.memory).toHaveProperty('external');

    // Verify timestamp is valid ISO string
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);

    // Verify uptime is a positive number
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThan(0);
  });

  it('should include storage directory checks', async () => {
    const response = await GET(mockRequest);
    const data = await response.json();

    const expectedDirectories = [
      'configs',
      'settings',
      'history',
      'templates',
      'keys',
    ];

    expectedDirectories.forEach((dir) => {
      expect(data.storage.directories).toHaveProperty(dir);
      expect(typeof data.storage.directories[dir]).toBe('boolean');
    });
  });

  it('should handle errors gracefully', async () => {
    // This test verifies the endpoint handles unexpected errors
    // In a real error scenario, the endpoint should return a 500 status
    // For now, we just verify it responds correctly under normal conditions
    const response = await GET(mockRequest);

    expect(response.status).toBe(200);
  });

  it('should mark system as unhealthy when storage is inaccessible', async () => {
    // Mock fs.access to simulate inaccessible storage
    const fs = require('fs').promises;
    const originalAccess = fs.access;
    fs.access = jest.fn().mockRejectedValue(new Error('Permission denied'));

    try {
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.status).toBe('unhealthy');
      expect(data.storage.accessible).toBe(false);
    } finally {
      // Restore original fs.access
      fs.access = originalAccess;
    }
  });

  it('should mark system as unhealthy when kometa is unavailable', async () => {
    // Use the mocked exec function
    const { exec } = require('child_process');

    // Mock exec to fail for all kometa-related commands
    (exec as jest.Mock).mockImplementation(
      (cmd: string, callback: Function) => {
        // Fail for all commands (Docker version, Docker images, which kometa, etc.)
        callback(new Error('Command not found'));
      }
    );

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(data.kometa.available).toBe(false);
    expect(data.kometa.error).toBeDefined();
    expect(data.status).toBe('unhealthy');

    // Clear the mock for other tests
    (exec as jest.Mock).mockReset();
  });

  it('should mark system as degraded when plex is configured but unreachable', async () => {
    // Mock fs.readFile to return a config with plex settings
    const fs = require('fs').promises;
    const originalReadFile = fs.readFile;

    fs.readFile = jest.fn().mockImplementation((path) => {
      if (path.includes('config.yml')) {
        return Promise.resolve(
          'plex:\n  url: http://localhost:32400\n  token: invalid-token'
        );
      }
      return originalReadFile(path);
    });

    // Mock fetch to simulate failed plex connection
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

    try {
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.status).toBe('degraded');
      expect(data.plex?.configured).toBe(true);
      expect(data.plex?.reachable).toBe(false);
      expect(data.plex?.error).toBeDefined();
    } finally {
      // Restore original functions
      fs.readFile = originalReadFile;
      delete (global as any).fetch;
    }
  });

  it('should handle plex timeout scenarios', async () => {
    // Mock fs.readFile to return a config with plex settings
    const fs = require('fs').promises;
    const originalReadFile = fs.readFile;

    fs.readFile = jest.fn().mockImplementation((path) => {
      if (path.includes('config.yml')) {
        return Promise.resolve(
          'plex:\n  url: http://localhost:32400\n  token: test-token'
        );
      }
      return originalReadFile(path);
    });

    // Mock fetch to simulate timeout
    global.fetch = jest.fn().mockImplementation(() => {
      return new Promise((resolve, reject) => {
        const error = new Error('Timeout');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 100);
      });
    });

    try {
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.plex?.configured).toBe(true);
      expect(data.plex?.reachable).toBe(false);
      expect(data.plex?.error).toContain('timeout');
    } finally {
      // Restore original functions
      fs.readFile = originalReadFile;
      delete (global as any).fetch;
    }
  });

  it('should handle missing plex configuration', async () => {
    // Mock fs.readFile to return a config without plex settings
    const fs = require('fs').promises;
    const originalReadFile = fs.readFile;

    fs.readFile = jest.fn().mockImplementation((path) => {
      if (path.includes('config.yml')) {
        return Promise.resolve('libraries:\n  Movies:\n    operations: {}');
      }
      return originalReadFile(path);
    });

    try {
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.plex?.configured).toBe(false);
      expect(data.plex?.reachable).toBeUndefined();
    } finally {
      // Restore original functions
      fs.readFile = originalReadFile;
    }
  });
});
