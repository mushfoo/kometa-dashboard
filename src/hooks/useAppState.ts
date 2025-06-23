import { useSettingsStore } from '@/stores/settingsStore';
import { useConfigStore } from '@/stores/configStore';
import { useQuery } from '@tanstack/react-query';

interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  version: string;
  storage: {
    accessible: boolean;
    directories: Record<string, boolean>;
  };
  kometa: {
    available: boolean;
    method?: 'docker' | 'path';
    version?: string;
    error?: string;
  };
  plex?: {
    configured: boolean;
    reachable?: boolean;
    error?: string;
  };
}

export function useAppState() {
  const settings = useSettingsStore();
  const config = useConfigStore();

  const { data: systemStatus, isLoading: statusLoading } =
    useQuery<SystemStatus>({
      queryKey: ['system-status'],
      queryFn: async () => {
        const response = await fetch('/api/status');
        if (!response.ok) {
          throw new Error('Failed to fetch system status');
        }
        return response.json();
      },
      refetchInterval: settings.autoRefresh ? settings.pollingInterval : false,
    });

  const toggleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = [
      'light',
      'dark',
      'system',
    ];
    const currentIndex = themes.indexOf(settings.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    if (nextTheme) {
      settings.setTheme(nextTheme);
    }
  };

  return {
    // Settings
    theme: settings.theme,
    pollingInterval: settings.pollingInterval,
    logLevel: settings.logLevel,
    autoRefresh: settings.autoRefresh,
    setTheme: settings.setTheme,
    setPollingInterval: settings.setPollingInterval,
    setLogLevel: settings.setLogLevel,
    setAutoRefresh: settings.setAutoRefresh,
    toggleTheme,

    // Config
    currentConfig: config.currentConfig,
    isConfigDirty: config.isDirty,
    isConfigLoading: config.isLoading,
    configError: config.error,
    setCurrentConfig: config.setCurrentConfig,
    setConfigDirty: config.setIsDirty,

    // System Status
    systemStatus,
    isStatusLoading: statusLoading,
    isHealthy: systemStatus?.status === 'healthy',
  };
}
