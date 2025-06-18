import { POST } from '@/app/api/config/plex/test/route';
import { apiHelpers } from '../../utils/testUtils';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('/api/config/plex/test', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully test Plex connection and return libraries', async () => {
    const mockServerResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        MediaContainer: {
          friendlyName: 'My Plex Server',
          version: '1.32.8.7376',
          platform: 'Linux',
          machineIdentifier: 'abc123',
        },
      }),
    };

    const mockLibrariesResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        MediaContainer: {
          Directory: [
            {
              key: '1',
              title: 'Movies',
              type: 'movie',
              updatedAt: 1640995200,
            },
            {
              key: '2',
              title: 'TV Shows',
              type: 'show',
              updatedAt: 1640995300,
            },
          ],
        },
      }),
    };

    mockFetch
      .mockResolvedValueOnce(mockServerResponse as any)
      .mockResolvedValueOnce(mockLibrariesResponse as any);

    const request = apiHelpers.createMockNextRequest(
      'http://localhost:3000/api/config/plex/test',
      {
        method: 'POST',
        body: JSON.stringify({
          url: 'http://localhost:32400',
          token: 'test-token-123456789012',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      serverInfo: {
        friendlyName: 'My Plex Server',
        version: '1.32.8.7376',
        platform: 'Linux',
        machineIdentifier: 'abc123',
      },
      libraries: [
        {
          key: '1',
          title: 'Movies',
          type: 'movie',
          updatedAt: 1640995200,
        },
        {
          key: '2',
          title: 'TV Shows',
          type: 'show',
          updatedAt: 1640995300,
        },
      ],
    });

    // Verify fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://localhost:32400/', {
      method: 'GET',
      headers: {
        'X-Plex-Token': 'test-token-123456789012',
        Accept: 'application/json',
      },
      signal: expect.any(AbortSignal),
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:32400/library/sections',
      {
        method: 'GET',
        headers: {
          'X-Plex-Token': 'test-token-123456789012',
          Accept: 'application/json',
        },
        signal: expect.any(AbortSignal),
      }
    );
  });

  it('should handle server connection failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as any);

    const request = apiHelpers.createMockNextRequest(
      'http://localhost:3000/api/config/plex/test',
      {
        method: 'POST',
        body: JSON.stringify({
          url: 'http://localhost:32400',
          token: 'invalid-token-123456789',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: 'Failed to connect to Plex server',
      details: 'HTTP 401: Unauthorized',
    });
  });

  it('should handle libraries fetch failure', async () => {
    const mockServerResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        MediaContainer: {
          friendlyName: 'My Plex Server',
        },
      }),
    };

    const mockLibrariesResponse = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    };

    mockFetch
      .mockResolvedValueOnce(mockServerResponse as any)
      .mockResolvedValueOnce(mockLibrariesResponse as any);

    const request = apiHelpers.createMockNextRequest(
      'http://localhost:3000/api/config/plex/test',
      {
        method: 'POST',
        body: JSON.stringify({
          url: 'http://localhost:32400',
          token: 'test-token-123456789012',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: 'Connected to server but failed to retrieve libraries',
      details: 'HTTP 403: Forbidden',
    });
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const request = apiHelpers.createMockNextRequest(
      'http://localhost:3000/api/config/plex/test',
      {
        method: 'POST',
        body: JSON.stringify({
          url: 'http://unreachable-server:32400',
          token: 'test-token-123456789012',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: 'Network error - unable to reach Plex server',
      details: 'Please check the URL and ensure the server is accessible',
    });
  });

  it('should handle connection timeout', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const request = apiHelpers.createMockNextRequest(
      'http://localhost:3000/api/config/plex/test',
      {
        method: 'POST',
        body: JSON.stringify({
          url: 'http://slow-server:32400',
          token: 'test-token-123456789012',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: 'Connection timeout',
      details: 'The Plex server did not respond within 10 seconds',
    });
  });

  it('should validate request data', async () => {
    const request = apiHelpers.createMockNextRequest(
      'http://localhost:3000/api/config/plex/test',
      {
        method: 'POST',
        body: JSON.stringify({
          url: 'invalid-url',
          token: '',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid connection data');
    expect(data.details).toBeDefined();
  });

  it('should clean up trailing slashes from URL', async () => {
    const mockServerResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        MediaContainer: { friendlyName: 'Test Server' },
      }),
    };

    const mockLibrariesResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        MediaContainer: { Directory: [] },
      }),
    };

    mockFetch
      .mockResolvedValueOnce(mockServerResponse as any)
      .mockResolvedValueOnce(mockLibrariesResponse as any);

    const request = apiHelpers.createMockNextRequest(
      'http://localhost:3000/api/config/plex/test',
      {
        method: 'POST',
        body: JSON.stringify({
          url: 'http://localhost:32400/',
          token: 'test-token-123456789012',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    await POST(request);

    // Verify URL was cleaned up (no trailing slash)
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:32400/',
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:32400/library/sections',
      expect.any(Object)
    );
  });

  it('should handle empty libraries response gracefully', async () => {
    const mockServerResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        MediaContainer: {
          friendlyName: 'Empty Server',
        },
      }),
    };

    const mockLibrariesResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        MediaContainer: {}, // No Directory property
      }),
    };

    mockFetch
      .mockResolvedValueOnce(mockServerResponse as any)
      .mockResolvedValueOnce(mockLibrariesResponse as any);

    const request = apiHelpers.createMockNextRequest(
      'http://localhost:3000/api/config/plex/test',
      {
        method: 'POST',
        body: JSON.stringify({
          url: 'http://localhost:32400',
          token: 'test-token-123456789012',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.libraries).toEqual([]);
  });
});
