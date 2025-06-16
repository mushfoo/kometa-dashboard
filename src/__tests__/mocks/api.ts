import { http, HttpResponse, delay } from 'msw';

// Define the base URL for API routes
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export const handlers = [
  // System status endpoint
  http.get(`${API_BASE}/api/status`, async () => {
    await delay(100); // Simulate network delay
    return HttpResponse.json({
      status: 'healthy',
      version: '0.1.0',
      uptime: 123456,
      memory: {
        used: 256 * 1024 * 1024, // 256MB
        total: 512 * 1024 * 1024, // 512MB
      },
      kometaAvailable: true,
      plexConnected: true,
    });
  }),

  // Configuration endpoints
  http.get(`${API_BASE}/api/config`, async () => {
    await delay(100);
    return HttpResponse.json({
      plex: {
        url: 'http://localhost:32400',
        token: '***',
      },
      libraries: ['Movies', 'TV Shows'],
      apiKeys: {
        tmdb: { configured: true },
        trakt: { configured: false },
        imdb: { configured: false },
      },
    });
  }),

  http.put(`${API_BASE}/api/config`, async ({ request }) => {
    await delay(200);
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      config: body,
    });
  }),

  http.post(`${API_BASE}/api/config/validate`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as Record<string, any>;

    // Simulate validation
    if (!body?.plex || !body?.libraries) {
      return HttpResponse.json(
        {
          valid: false,
          errors: ['Missing required fields: plex configuration'],
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      valid: true,
      warnings: [],
    });
  }),

  // API keys endpoints
  http.get(`${API_BASE}/api/keys`, async () => {
    await delay(100);
    return HttpResponse.json({
      services: [
        {
          name: 'tmdb',
          configured: true,
          lastValidated: new Date().toISOString(),
        },
        { name: 'trakt', configured: false },
        { name: 'imdb', configured: false },
      ],
    });
  }),

  http.post(`${API_BASE}/api/keys`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Record<string, any>;
    return HttpResponse.json({
      success: true,
      service: body?.service,
      configured: true,
    });
  }),

  // Collections endpoints
  http.get(`${API_BASE}/api/collections`, async () => {
    await delay(100);
    return HttpResponse.json({
      collections: [
        {
          id: '1',
          name: 'Marvel Movies',
          type: 'smart',
          itemCount: 28,
          lastUpdated: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Top Rated',
          type: 'manual',
          itemCount: 50,
          lastUpdated: new Date().toISOString(),
        },
      ],
    });
  }),

  // Operations endpoints
  http.get(`${API_BASE}/api/operations`, async () => {
    await delay(100);
    return HttpResponse.json({
      operations: [
        {
          id: '1',
          type: 'scan',
          status: 'completed',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date(Date.now() - 1800000).toISOString(),
          duration: 1800000,
        },
      ],
    });
  }),

  http.post(`${API_BASE}/api/operations/start`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Record<string, any>;
    return HttpResponse.json({
      success: true,
      operationId: 'op_' + Date.now(),
      type: body?.type,
      status: 'queued',
    });
  }),

  // Logs endpoint
  http.get(`${API_BASE}/api/logs`, async ({ request }) => {
    await delay(100);
    const url = new URL(request.url);
    const level = url.searchParams.get('level') || 'all';

    return HttpResponse.json({
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: 'Kometa started successfully',
        },
        {
          timestamp: new Date(Date.now() - 1000).toISOString(),
          level: 'DEBUG',
          message: 'Loading configuration from config.yml',
        },
      ].filter((log) => level === 'all' || log.level === level.toUpperCase()),
    });
  }),

  // Error simulation endpoints for testing
  http.get(`${API_BASE}/api/error/500`, () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),

  http.get(`${API_BASE}/api/error/404`, () => {
    return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
  }),
];
