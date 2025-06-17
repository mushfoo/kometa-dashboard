import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  pollingInterval: number;
  logLevel: 'debug' | 'info' | 'warning' | 'error';
  autoRefresh: boolean;
  // eslint-disable-next-line no-unused-vars
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  // eslint-disable-next-line no-unused-vars
  setPollingInterval: (interval: number) => void;
  // eslint-disable-next-line no-unused-vars
  setLogLevel: (level: 'debug' | 'info' | 'warning' | 'error') => void;
  // eslint-disable-next-line no-unused-vars
  setAutoRefresh: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      pollingInterval: 30000, // 30 seconds
      logLevel: 'info',
      autoRefresh: true,
      setTheme: (_theme) => set({ theme: _theme }),
      setPollingInterval: (_interval) => set({ pollingInterval: _interval }),
      setLogLevel: (_level) => set({ logLevel: _level }),
      setAutoRefresh: (_enabled) => set({ autoRefresh: _enabled }),
    }),
    {
      name: 'kometa-settings',
    }
  )
);
