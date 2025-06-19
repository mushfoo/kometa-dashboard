'use client';

import { Card } from '@/components/ui/card';
import Link from 'next/link';
import {
  Server,
  Key,
  Library,
  FileCode,
  Download,
  Layout,
  ChevronRight,
} from 'lucide-react';

const configSections = [
  {
    title: 'Dual-Pane Editor',
    description: 'Configure Kometa using forms with live YAML preview',
    href: '/config/dual-pane',
    icon: Layout,
    color: 'bg-purple-500',
    badge: 'New',
  },
  {
    title: 'Plex Connection',
    description: 'Configure your Plex server connection and library settings',
    href: '/config/plex',
    icon: Server,
    color: 'bg-blue-500',
  },
  {
    title: 'API Keys',
    description: 'Manage API keys for TMDb, Trakt, IMDb, and other services',
    href: '/config/api-keys',
    icon: Key,
    color: 'bg-green-500',
  },
  {
    title: 'Library Settings',
    description: 'Configure library-specific settings and operations',
    href: '/config/libraries',
    icon: Library,
    color: 'bg-orange-500',
  },
  {
    title: 'YAML Editor',
    description: 'Edit your configuration directly in YAML format',
    href: '/config/yaml',
    icon: FileCode,
    color: 'bg-red-500',
  },
  {
    title: 'Import/Export',
    description: 'Import existing configurations or export your current setup',
    href: '/config/import-export',
    icon: Download,
    color: 'bg-indigo-500',
  },
];

export default function ConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Choose how you want to configure Kometa
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {configSections.map((section) => {
          const Icon = section.icon;

          return (
            <Link key={section.href} href={section.href}>
              <Card className="h-full p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="flex items-start justify-between">
                  <div className={`${section.color} p-3 rounded-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  {section.badge && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      {section.badge}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-semibold group-hover:text-primary transition-colors">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {section.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-primary">
                  Open
                  <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
