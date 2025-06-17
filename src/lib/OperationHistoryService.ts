import { FileStorageService } from './file-storage-service';
import path from 'path';
import { z } from 'zod';

// Operation history entry schema
const OperationHistoryEntry = z.object({
  id: z.string(),
  type: z.enum([
    'full_run',
    'collections_only',
    'library_only',
    'config_reload',
  ]),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  duration: z.number().optional(), // in milliseconds
  progress: z
    .object({
      current: z.number(),
      total: z.number(),
      currentItem: z.string().optional(),
    })
    .optional(),
  parameters: z.record(z.unknown()).optional(),
  results: z
    .object({
      collectionsProcessed: z.number().optional(),
      itemsUpdated: z.number().optional(),
      errors: z.array(z.string()).optional(),
    })
    .optional(),
  logs: z.array(z.string()).optional(), // Array of log entry IDs
});

type OperationHistoryEntry = z.infer<typeof OperationHistoryEntry>;

const OperationHistory = z.object({
  operations: z.array(OperationHistoryEntry),
  lastUpdated: z.string().datetime(),
});

type OperationHistory = z.infer<typeof OperationHistory>;

// Query parameters for filtering operations
const OperationQueryParams = z.object({
  status: z
    .enum(['queued', 'running', 'completed', 'failed', 'cancelled'])
    .optional(),
  type: z
    .enum(['full_run', 'collections_only', 'library_only', 'config_reload'])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

class OperationHistoryService {
  private storage: FileStorageService;
  private readonly maxHistoryEntries = 100;

  constructor() {
    this.storage = new FileStorageService(
      path.join(process.cwd(), 'storage', 'history')
    );
  }

  async getHistory(): Promise<OperationHistory> {
    const history =
      await this.storage.read<OperationHistory>('operations.json');

    if (!history) {
      return {
        operations: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    return history;
  }

  async addOperation(
    operation: Omit<OperationHistoryEntry, 'id'>
  ): Promise<string> {
    const history = await this.getHistory();
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newOperation: OperationHistoryEntry = {
      ...operation,
      id: operationId,
    };

    history.operations.unshift(newOperation);

    // Keep only the last maxHistoryEntries
    if (history.operations.length > this.maxHistoryEntries) {
      history.operations = history.operations.slice(0, this.maxHistoryEntries);
    }

    history.lastUpdated = new Date().toISOString();

    await this.storage.write('operations.json', history);

    return operationId;
  }

  async updateOperation(
    operationId: string,
    updates: Partial<OperationHistoryEntry>
  ): Promise<void> {
    const history = await this.getHistory();
    const operationIndex = history.operations.findIndex(
      (op) => op.id === operationId
    );

    if (operationIndex === -1) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const existingOperation = history.operations[operationIndex];
    if (!existingOperation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    history.operations[operationIndex] = {
      ...existingOperation,
      ...updates,
    };

    history.lastUpdated = new Date().toISOString();

    await this.storage.write('operations.json', history);
  }

  filterOperations(
    operations: OperationHistoryEntry[],
    filters: z.infer<typeof OperationQueryParams>
  ): OperationHistoryEntry[] {
    let filtered = operations;

    if (filters.status) {
      filtered = filtered.filter((op) => op.status === filters.status);
    }

    if (filters.type) {
      filtered = filtered.filter((op) => op.type === filters.type);
    }

    if (filters.startDate) {
      filtered = filtered.filter((op) => op.startTime >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter((op) => op.startTime <= filters.endDate!);
    }

    // Apply pagination
    const start = filters.offset;
    const end = start + filters.limit;

    return filtered.slice(start, end);
  }
}

export {
  OperationHistoryService,
  OperationHistoryEntry,
  OperationHistory,
  OperationQueryParams,
};
export type { OperationHistoryEntry as OperationHistoryEntryType };
