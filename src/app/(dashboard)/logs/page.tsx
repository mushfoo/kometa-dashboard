'use client';

import { LogViewer } from '@/components/dashboard/LogViewer';

export default function LogsPage() {
  return (
    <>
      <h1 className="text-3xl font-bold mb-6">Logs</h1>
      <LogViewer maxHeight="calc(100vh - 200px)" />
    </>
  );
}
