'use client';

import dynamic from 'next/dynamic';
import type { AppUser } from '@/lib/types';

const StudioWorkspace = dynamic(() => import('./StudioWorkspace'), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-dvh place-items-center text-muted-foreground">
      Opening canvas…
    </div>
  ),
});

export default function StudioWorkspaceLoader({
  projectId,
  freeCreditModelsOnly,
  user,
}: {
  projectId: string;
  freeCreditModelsOnly: boolean;
  user: AppUser | null;
}) {
  return (
    <StudioWorkspace
      projectId={projectId}
      freeCreditModelsOnly={freeCreditModelsOnly}
      user={user}
    />
  );
}
