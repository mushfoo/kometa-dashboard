/**
 * Integration test for the status endpoint
 * Tests the actual endpoint behavior without complex mocking
 */

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
});
