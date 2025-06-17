import { ReactNode } from 'react';
import { Layout } from '@/components/layout/Layout';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <Layout>{children}</Layout>;
}
