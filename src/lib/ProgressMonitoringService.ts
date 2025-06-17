import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

// Progress entry schema
const ProgressEntrySchema = z.object({
  operationId: z.string(),
  type: z.enum(['collection', 'library', 'metadata', 'overlay', 'operation']),
  name: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'skipped']),
  progress: z.number().min(0).max(100),
  currentItem: z.string().optional(),
  totalItems: z.number().optional(),
  processedItems: z.number().optional(),
  startTime: z.date(),
  endTime: z.date().optional(),
  duration: z.number().optional(), // milliseconds
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ProgressEntry = z.infer<typeof ProgressEntrySchema>;

// Operation progress schema
const OperationProgressSchema = z.object({
  operationId: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  startTime: z.date(),
  endTime: z.date().optional(),
  duration: z.number().optional(),
  progress: z.number().min(0).max(100),
  currentPhase: z.string().optional(),
  phases: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['pending', 'running', 'completed', 'failed']),
      progress: z.number().min(0).max(100),
      startTime: z.date().optional(),
      endTime: z.date().optional(),
    })
  ),
  collections: z.array(ProgressEntrySchema),
  libraries: z.array(ProgressEntrySchema),
  stats: z.object({
    totalCollections: z.number(),
    processedCollections: z.number(),
    totalLibraries: z.number(),
    processedLibraries: z.number(),
    totalItems: z.number(),
    processedItems: z.number(),
    errors: z.number(),
    warnings: z.number(),
  }),
});

export type OperationProgress = z.infer<typeof OperationProgressSchema>;

// Progress monitoring configuration
export interface ProgressMonitoringConfig {
  storageDirectory: string;
  updateInterval: number; // milliseconds
  maxProgressHistory: number;
  enablePersistence: boolean;
}

const DEFAULT_CONFIG: ProgressMonitoringConfig = {
  storageDirectory: './storage/progress',
  updateInterval: 1000, // 1 second
  maxProgressHistory: 100,
  enablePersistence: true,
};

// Kometa progress patterns for parsing
const PROGRESS_PATTERNS = [
  // Collection processing: "Processing collection: Movies"
  {
    regex: /Processing collection:\s*(.+)/i,
    type: 'collection' as const,
    status: 'running' as const,
  },
  // Library scanning: "Scanning library: TV Shows (50/100)"
  {
    regex: /Scanning library:\s*([^(]+)(?:\s*\((\d+)\/(\d+)\))?/i,
    type: 'library' as const,
    status: 'running' as const,
  },
  // Progress percentage: "Progress: 75%"
  {
    regex: /Progress:\s*(\d+)%/i,
    type: 'operation' as const,
  },
  // Completed: "Collection 'Action Movies' completed"
  {
    regex: /Collection\s*'([^']+)'\s*completed/i,
    type: 'collection' as const,
    status: 'completed' as const,
  },
  // Failed: "Failed to process collection: Drama"
  {
    regex: /Failed to process\s+(collection|library):\s*(.+)/i,
    type: 'collection' as const,
    status: 'failed' as const,
  },
  // Item processing: "Processing item 25 of 100"
  {
    regex: /Processing item\s*(\d+)\s*of\s*(\d+)/i,
    type: 'metadata' as const,
    status: 'running' as const,
  },
];

/**
 * ProgressMonitoringService tracks and manages operation progress,
 * parsing Kometa output to provide real-time progress updates.
 */
export class ProgressMonitoringService extends EventEmitter {
  private config: ProgressMonitoringConfig;
  private activeOperations: Map<string, OperationProgress> = new Map();
  private progressHistory: OperationProgress[] = [];
  private updateTimer: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(config: Partial<ProgressMonitoringConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setMaxListeners(50);
  }

  /**
   * Start monitoring for a new operation
   */
  async startMonitoring(
    operationId: string,
    operationType: string
  ): Promise<void> {
    if (this.activeOperations.has(operationId)) {
      throw new Error(`Operation ${operationId} is already being monitored`);
    }

    const operationProgress: OperationProgress = {
      operationId,
      status: 'running',
      startTime: new Date(),
      progress: 0,
      currentPhase: 'initializing',
      phases: [
        { name: 'initialization', status: 'running', progress: 0 },
        { name: 'library_scan', status: 'pending', progress: 0 },
        { name: 'collection_processing', status: 'pending', progress: 0 },
        { name: 'metadata_update', status: 'pending', progress: 0 },
        { name: 'finalization', status: 'pending', progress: 0 },
      ],
      collections: [],
      libraries: [],
      stats: {
        totalCollections: 0,
        processedCollections: 0,
        totalLibraries: 0,
        processedLibraries: 0,
        totalItems: 0,
        processedItems: 0,
        errors: 0,
        warnings: 0,
      },
    };

    this.activeOperations.set(operationId, operationProgress);
    this.isMonitoring = true;

    // Start update timer if not already running
    if (!this.updateTimer) {
      this.startUpdateTimer();
    }

    // Persist initial state
    if (this.config.enablePersistence) {
      await this.persistProgress(operationProgress);
    }

    this.emit('monitoringStarted', { operationId, operationType });
  }

  /**
   * Stop monitoring an operation
   */
  async stopMonitoring(
    operationId: string,
    status: 'completed' | 'failed' | 'cancelled' = 'completed'
  ): Promise<void> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} is not being monitored`);
    }

    // Update final status
    operation.status = status;
    operation.endTime = new Date();
    operation.duration =
      operation.endTime.getTime() - operation.startTime.getTime();
    operation.progress = status === 'completed' ? 100 : operation.progress;

    // Update current phase
    const currentPhase = operation.phases.find((p) => p.status === 'running');
    if (currentPhase) {
      currentPhase.status = status === 'completed' ? 'completed' : 'failed';
      currentPhase.endTime = new Date();
    }

    // Move to history
    this.progressHistory.unshift(operation);
    if (this.progressHistory.length > this.config.maxProgressHistory) {
      this.progressHistory.pop();
    }

    // Remove from active operations
    this.activeOperations.delete(operationId);

    // Persist final state
    if (this.config.enablePersistence) {
      await this.persistProgress(operation);
      await this.persistHistory();
    }

    // Stop update timer if no more active operations
    if (this.activeOperations.size === 0) {
      this.stopUpdateTimer();
      this.isMonitoring = false;
    }

    this.emit('monitoringStopped', { operationId, status });
  }

  /**
   * Process a log line and extract progress information
   */
  processLogLine(operationId: string, logLine: string): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return;
    }

    // Try each pattern
    for (const pattern of PROGRESS_PATTERNS) {
      const match = logLine.match(pattern.regex);
      if (match) {
        this.updateProgressFromMatch(operation, pattern, match);
        break;
      }
    }

    // Emit progress update
    this.emit('progressUpdate', {
      operationId,
      progress: operation.progress,
      currentPhase: operation.currentPhase,
      stats: operation.stats,
    });
  }

  /**
   * Get current progress for an operation
   */
  getOperationProgress(operationId: string): OperationProgress | undefined {
    return this.activeOperations.get(operationId);
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): OperationProgress[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Get operation history
   */
  getProgressHistory(limit?: number): OperationProgress[] {
    return limit
      ? this.progressHistory.slice(0, limit)
      : [...this.progressHistory];
  }

  /**
   * Calculate estimated time remaining
   */
  getEstimatedTimeRemaining(operationId: string): number | undefined {
    const operation = this.activeOperations.get(operationId);
    if (!operation || operation.progress === 0) {
      return undefined;
    }

    const elapsed = Date.now() - operation.startTime.getTime();
    const estimatedTotal = (elapsed / operation.progress) * 100;
    const remaining = estimatedTotal - elapsed;

    return Math.max(0, Math.round(remaining));
  }

  /**
   * Cancel an operation (request graceful termination)
   */
  async cancelOperation(operationId: string): Promise<void> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    if (operation.status !== 'running') {
      throw new Error(`Operation ${operationId} is not running`);
    }

    this.emit('cancellationRequested', { operationId });

    // The actual cancellation would be handled by the process manager
    // This just updates the status
    await this.stopMonitoring(operationId, 'cancelled');
  }

  /**
   * Load progress history from storage
   */
  async loadProgressHistory(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      const historyPath = path.join(
        this.config.storageDirectory,
        'progress-history.json'
      );
      const content = await fs.readFile(historyPath, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        this.progressHistory = data.map((item) => ({
          ...item,
          startTime: new Date(item.startTime),
          endTime: item.endTime ? new Date(item.endTime) : undefined,
        }));
      }
    } catch (error) {
      // File doesn't exist or is invalid - that's okay
      this.progressHistory = [];
    }
  }

  /**
   * Update progress from regex match
   */
  private updateProgressFromMatch(
    operation: OperationProgress,
    pattern: (typeof PROGRESS_PATTERNS)[0],
    match: RegExpMatchArray
  ): void {
    switch (pattern.type) {
      case 'collection':
        this.updateCollectionProgress(operation, match, pattern.status);
        break;
      case 'library':
        this.updateLibraryProgress(operation, match, pattern.status);
        break;
      case 'operation':
        this.updateOperationProgress(operation, match);
        break;
      case 'metadata':
        this.updateMetadataProgress(operation, match);
        break;
    }
  }

  /**
   * Update collection progress
   */
  private updateCollectionProgress(
    operation: OperationProgress,
    match: RegExpMatchArray,
    status?: ProgressEntry['status']
  ): void {
    // For failure pattern, the name is in match[2]
    const name =
      status === 'failed' && match[2] ? match[2] : match[1] || 'Unknown';

    let collection = operation.collections.find((c) => c.name === name);
    if (!collection) {
      collection = {
        operationId: operation.operationId,
        type: 'collection',
        name,
        status: status || 'running',
        progress: 0,
        startTime: new Date(),
      };
      operation.collections.push(collection);
      operation.stats.totalCollections++;
    } else {
      collection.status = status || collection.status;
    }

    if (status === 'completed') {
      collection.progress = 100;
      collection.endTime = new Date();
      collection.duration =
        collection.endTime.getTime() - collection.startTime.getTime();
      operation.stats.processedCollections++;
    } else if (status === 'failed') {
      collection.error = `Failed to process collection: ${name}`;
      operation.stats.errors++;
    }

    // Update phase
    this.updatePhase(operation, 'collection_processing');
  }

  /**
   * Update library progress
   */
  private updateLibraryProgress(
    operation: OperationProgress,
    match: RegExpMatchArray,
    status?: ProgressEntry['status']
  ): void {
    const name = match[1]?.trim() || 'Unknown';
    const processed = match[2] ? parseInt(match[2], 10) : undefined;
    const total = match[3] ? parseInt(match[3], 10) : undefined;

    let library = operation.libraries.find((l) => l.name === name);
    if (!library) {
      library = {
        operationId: operation.operationId,
        type: 'library',
        name,
        status: status || 'running',
        progress: 0,
        processedItems: processed,
        totalItems: total,
        startTime: new Date(),
      };
      operation.libraries.push(library);
      operation.stats.totalLibraries++;
    } else {
      library.processedItems = processed || library.processedItems;
      library.totalItems = total || library.totalItems;
    }

    // Calculate progress
    if (library.totalItems && library.processedItems) {
      library.progress = (library.processedItems / library.totalItems) * 100;
    }

    // Update phase
    this.updatePhase(operation, 'library_scan');
  }

  /**
   * Update overall operation progress
   */
  private updateOperationProgress(
    operation: OperationProgress,
    match: RegExpMatchArray
  ): void {
    const progress = parseInt(match[1] || '0', 10);
    operation.progress = Math.min(100, Math.max(0, progress));
  }

  /**
   * Update metadata processing progress
   */
  private updateMetadataProgress(
    operation: OperationProgress,
    match: RegExpMatchArray
  ): void {
    const current = parseInt(match[1] || '0', 10);
    const total = parseInt(match[2] || '0', 10);

    operation.stats.processedItems = current;
    operation.stats.totalItems = total;

    // Update phase
    this.updatePhase(operation, 'metadata_update');
  }

  /**
   * Update operation phase
   */
  private updatePhase(operation: OperationProgress, phaseName: string): void {
    const phase = operation.phases.find((p) => p.name === phaseName);
    if (!phase) return;

    // Mark previous phases as completed
    const phaseIndex = operation.phases.indexOf(phase);
    for (let i = 0; i < phaseIndex; i++) {
      const prevPhase = operation.phases[i];
      if (prevPhase && prevPhase.status !== 'completed') {
        prevPhase.status = 'completed';
        prevPhase.progress = 100;
        prevPhase.endTime = new Date();
      }
    }

    // Update current phase
    if (phase.status === 'pending') {
      phase.status = 'running';
      phase.startTime = new Date();
    }

    operation.currentPhase = phaseName;

    // Calculate overall progress based on phases
    const completedPhases = operation.phases.filter(
      (p) => p.status === 'completed'
    ).length;
    const totalPhases = operation.phases.length;
    const phaseProgress = (completedPhases / totalPhases) * 100;

    // Use the higher of phase progress or reported progress
    operation.progress = Math.max(operation.progress, phaseProgress);
  }

  /**
   * Start the update timer
   */
  private startUpdateTimer(): void {
    this.updateTimer = setInterval(() => {
      this.updateActiveOperations();
    }, this.config.updateInterval);
  }

  /**
   * Stop the update timer
   */
  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Update all active operations
   */
  private updateActiveOperations(): void {
    for (const [operationId, operation] of this.activeOperations) {
      // Calculate overall progress based on collections and libraries
      const totalItems =
        operation.stats.totalCollections + operation.stats.totalLibraries;
      const processedItems =
        operation.stats.processedCollections +
        operation.libraries.filter((l) => l.progress > 0).length;

      if (totalItems > 0) {
        const calculatedProgress = (processedItems / totalItems) * 100;
        operation.progress = Math.max(operation.progress, calculatedProgress);
      }

      // Emit periodic update
      this.emit('progressUpdate', {
        operationId,
        progress: operation.progress,
        currentPhase: operation.currentPhase,
        stats: operation.stats,
        estimatedTimeRemaining: this.getEstimatedTimeRemaining(operationId),
      });
    }
  }

  /**
   * Persist operation progress to storage
   */
  private async persistProgress(operation: OperationProgress): Promise<void> {
    try {
      await fs.mkdir(this.config.storageDirectory, { recursive: true });

      const filePath = path.join(
        this.config.storageDirectory,
        `progress-${operation.operationId}.json`
      );

      await fs.writeFile(filePath, JSON.stringify(operation, null, 2));
    } catch (error) {
      this.emit('persistenceError', error);
    }
  }

  /**
   * Persist progress history
   */
  private async persistHistory(): Promise<void> {
    try {
      const historyPath = path.join(
        this.config.storageDirectory,
        'progress-history.json'
      );
      await fs.writeFile(
        historyPath,
        JSON.stringify(
          this.progressHistory.slice(0, this.config.maxProgressHistory),
          null,
          2
        )
      );
    } catch (error) {
      this.emit('persistenceError', error);
    }
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    isMonitoring: boolean;
    activeOperations: number;
    totalHistorySize: number;
    averageOperationDuration: number;
    successRate: number;
  } {
    const completedOperations = this.progressHistory.filter(
      (op) => op.status === 'completed'
    );
    const totalCompleted = completedOperations.length;
    const totalOperations = this.progressHistory.length;

    const averageDuration =
      totalCompleted > 0
        ? completedOperations.reduce((sum, op) => sum + (op.duration || 0), 0) /
          totalCompleted
        : 0;

    return {
      isMonitoring: this.isMonitoring,
      activeOperations: this.activeOperations.size,
      totalHistorySize: this.progressHistory.length,
      averageOperationDuration: averageDuration,
      successRate:
        totalOperations > 0 ? (totalCompleted / totalOperations) * 100 : 0,
    };
  }
}

/**
 * Create a progress monitoring service
 */
export function createProgressMonitoringService(
  config: Partial<ProgressMonitoringConfig> = {}
): ProgressMonitoringService {
  return new ProgressMonitoringService(config);
}
