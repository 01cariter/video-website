import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/user';
import AppShell from '../components/shell/AppShell';

// Keep the shared chrome light: only the signed-in user blocks the shell.
// Suggestions load client-side so route transitions are not held up by them.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return <AppShell user={user}>{children}</AppShell>;
}
