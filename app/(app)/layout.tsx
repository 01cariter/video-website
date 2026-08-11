import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/user';
import { getSuggestedAuthors } from '@/lib/profiles';
import AppShell from '../components/shell/AppShell';

// Shared X-style three-column chrome for every route inside the (app) group.
// No page lives under this group yet — pages migrate here starting Task 5.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const suggestions = await getSuggestedAuthors({ viewerId: user?.id ?? null, limit: 3 });

  return (
    <AppShell user={user} suggestions={suggestions}>
      {children}
    </AppShell>
  );
}
