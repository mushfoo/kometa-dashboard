import { GET } from '@/app/api/operations/route';
import { FileStorageService } from '@/lib/file-storage-service';

// Mock the FileStorageService
jest.mock('@/lib/file-storage-service');

// Mock NextRequest
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url: string) => ({
    url,
  })),
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

describe('/api/operations', () => {
  let mockFileStorageService: jest.Mocked<FileStorageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileStorageService = {
      read: jest.fn(),
      write: jest.fn(),
    } as any;

    (
      FileStorageService as jest.MockedClass<typeof FileStorageService>
    ).mockImplementation(() => mockFileStorageService);
  });

  describe('GET', () => {
    it('should handle null query parameters without error', async () => {
      mockFileStorageService.read.mockResolvedValue({
        operations: [],
        lastUpdated: new Date().toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/operations?limit=5'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toMatchObject({
        operations: [],
        total: 0,
        filtered: 0,
        pagination: {
          limit: 5,
          offset: 0,
          hasMore: false,
        },
      });
    });

    it('should handle missing query parameters', async () => {
      mockFileStorageService.read.mockResolvedValue({
        operations: [],
        lastUpdated: new Date().toISOString(),
      });

      const request = new NextRequest('http://localhost:3000/api/operations');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.pagination.limit).toBe(50); // default value
      expect(json.pagination.offset).toBe(0); // default value
    });

    it('should filter operations by status', async () => {
      const operations = [
        {
          id: '1',
          type: 'full_run',
          status: 'completed',
          startTime: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'full_run',
          status: 'failed',
          startTime: new Date().toISOString(),
        },
      ];

      mockFileStorageService.read.mockResolvedValue({
        operations,
        lastUpdated: new Date().toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/operations?status=completed'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.operations).toHaveLength(1);
      expect(json.operations[0].status).toBe('completed');
    });

    it('should handle file storage errors', async () => {
      mockFileStorageService.read.mockRejectedValue(
        new Error('File not found')
      );

      const request = new NextRequest('http://localhost:3000/api/operations');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to get operation history');
    });
  });
});
