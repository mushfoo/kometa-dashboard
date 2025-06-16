// Global type definitions for Kometa Dashboard

export interface KometaConfig {
  plex?: {
    url: string;
    token: string;
  };
  libraries?: Record<string, LibraryConfig>;
  settings?: Record<string, unknown>;
}

export interface LibraryConfig {
  library_type?: 'movie' | 'show' | 'music';
  collections?: Collection[];
}

export interface Collection {
  name: string;
  template?: string;
  filters?: Record<string, unknown>;
}

export interface ApiKey {
  service: string;
  key: string;
  isValid?: boolean;
}

export interface OperationStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  progress?: {
    current: number;
    total: number;
  };
}

export interface LogEntry {
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  source?: string;
}
