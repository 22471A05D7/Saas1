import { AppShell } from '@/components/layout/AppShell';

/** Every route in this group renders inside the authenticated shell. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
