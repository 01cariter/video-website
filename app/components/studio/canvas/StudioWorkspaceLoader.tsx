'use client';

import dynamic from 'next/dynamic';

const StudioWorkspace = dynamic(() => import('./StudioWorkspace'), {
  ssr: false,
  loading: () => <div className="grid min-h-dvh place-items-center text-muted-foreground">正在打开画布…</div>,
});

export default function StudioWorkspaceLoader({ projectId }: { projectId: string }) {
  return <StudioWorkspace projectId={projectId} />;
}
