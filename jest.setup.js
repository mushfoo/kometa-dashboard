import '@testing-library/jest-dom';

// TODO: Enable MSW after resolving module resolution issues
// import { server } from './src/__tests__/mocks/server';
// beforeAll(() => server.listen());
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());

// Mock Next.js Web APIs for testing
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Next.js Web APIs
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Request and Response for Next.js API routes
global.Request = class MockRequest {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body || null;
  }

  async json() {
    return this.body ? JSON.parse(this.body) : null;
  }

  async text() {
    return this.body || '';
  }
};

global.Response = class MockResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Map(Object.entries(init.headers || {}));
  }

  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }

  async text() {
    return typeof this.body === 'string'
      ? this.body
      : JSON.stringify(this.body);
  }
};

// Mock Headers
global.Headers = class MockHeaders extends Map {
  constructor(init) {
    super();
    if (init) {
      if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.set(key, value));
      } else if (typeof init === 'object') {
        Object.entries(init).forEach(([key, value]) => this.set(key, value));
      }
    }
  }

  get(name) {
    return super.get(name.toLowerCase());
  }

  set(name, value) {
    return super.set(name.toLowerCase(), value);
  }

  has(name) {
    return super.has(name.toLowerCase());
  }

  delete(name) {
    return super.delete(name.toLowerCase());
  }
};

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
