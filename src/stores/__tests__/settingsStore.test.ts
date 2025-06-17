import { renderHook, act } from '@testing-library/react';
import { useSettingsStore } from '../settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    useSettingsStore.setState({
      theme: 'system',
      pollingInterval: 30000,
      logLevel: 'info',
      autoRefresh: true,
    });
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useSettingsStore());

    expect(result.current.theme).toBe('system');
    expect(result.current.pollingInterval).toBe(30000);
    expect(result.current.logLevel).toBe('info');
    expect(result.current.autoRefresh).toBe(true);
  });

  it('should update theme', () => {
    const { result } = renderHook(() => useSettingsStore());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
  });

  it('should update polling interval', () => {
    const { result } = renderHook(() => useSettingsStore());

    act(() => {
      result.current.setPollingInterval(60000);
    });

    expect(result.current.pollingInterval).toBe(60000);
  });

  it('should update log level', () => {
    const { result } = renderHook(() => useSettingsStore());

    act(() => {
      result.current.setLogLevel('debug');
    });

    expect(result.current.logLevel).toBe('debug');
  });

  it('should update auto refresh', () => {
    const { result } = renderHook(() => useSettingsStore());

    act(() => {
      result.current.setAutoRefresh(false);
    });

    expect(result.current.autoRefresh).toBe(false);
  });
});
