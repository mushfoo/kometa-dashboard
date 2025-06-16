import { ApiException } from '@/lib/api-utils';

describe('ApiException', () => {
  it('should create exception with message and status', () => {
    const exception = new ApiException('Test error', 404);

    expect(exception.message).toBe('Test error');
    expect(exception.status).toBe(404);
    expect(exception.name).toBe('ApiException');
  });

  it('should default to status 500', () => {
    const exception = new ApiException('Test error');

    expect(exception.status).toBe(500);
  });

  it('should include details when provided', () => {
    const details = { field: 'validation error' };
    const exception = new ApiException('Test error', 400, details);

    expect(exception.details).toBe(details);
  });

  it('should extend Error correctly', () => {
    const exception = new ApiException('Test error');

    expect(exception instanceof Error).toBe(true);
    expect(exception instanceof ApiException).toBe(true);
  });
});
