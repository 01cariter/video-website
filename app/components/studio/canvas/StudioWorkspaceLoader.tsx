'use client';

import dynamic from 'next/dynamic';
import type { AppUser } from '@/lib/types';
import type { StudioRuntimeConfig } from '@/lib/studio/pricing';

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
  runtimeConfig,
  user,
}: {
  projectId: string;
  runtimeConfig: StudioRuntimeConfig;
  user: AppUser | null;
}) {
  return (
    <StudioWorkspace
      projectId={projectId}
      runtimeConfig={runtimeConfig}
      user={user}
    />
  );
}
