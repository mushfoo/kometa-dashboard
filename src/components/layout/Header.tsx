'use client';

import { Menu, Bell, Sun, Moon, Monitor, Circle } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme, systemStatus, isHealthy } = useAppState();

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-5 w-5" />;
      case 'dark':
        return <Moon className="h-5 w-5" />;
      case 'system':
        return <Monitor className="h-5 w-5" />;
    }
  };

  const getStatusColor = () => {
    if (!systemStatus) return 'text-gray-400';
    if (isHealthy) return 'text-green-500';
    return 'text-red-500';
  };

  const getStatusText = () => {
    if (!systemStatus) return 'Unknown';
    if (isHealthy) return 'Healthy';
    return 'Issues Detected';
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow border-b border-gray-200 dark:border-gray-700">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left side */}
        <div className="flex items-center">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Breadcrumbs */}
          <div className="ml-4 lg:ml-0">
            <Breadcrumbs />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* System status indicator */}
          <div className="flex items-center space-x-2">
            <Circle className={`h-3 w-3 fill-current ${getStatusColor()}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
              {getStatusText()}
            </span>
          </div>

          {/* Notifications */}
          <button className="relative rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300">
            <Bell className="h-5 w-5" />
            {/* Notification badge - uncomment when notifications are implemented */}
            {/* <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span> */}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title={`Current theme: ${theme}`}
          >
            {getThemeIcon()}
          </button>
        </div>
      </div>
    </header>
  );
}
