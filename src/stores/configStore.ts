import { create } from 'zustand';

interface ConfigState {
  currentConfig: Record<string, any> | null;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  // eslint-disable-next-line no-unused-vars
  setCurrentConfig: (config: Record<string, any>) => void;
  // eslint-disable-next-line no-unused-vars
  setIsDirty: (isDirty: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  setIsLoading: (isLoading: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  setError: (error: string | null) => void;
  resetConfig: () => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  currentConfig: null,
  isDirty: false,
  isLoading: false,
  error: null,
  setCurrentConfig: (_config) =>
    set({ currentConfig: _config, isDirty: false }),
  setIsDirty: (_isDirty) => set({ isDirty: _isDirty }),
  setIsLoading: (_isLoading) => set({ isLoading: _isLoading }),
  setError: (_error) => set({ error: _error }),
  resetConfig: () => set({ currentConfig: null, isDirty: false, error: null }),
}));
