'use client';

import dynamic from 'next/dynamic';

const StudioWorkspace = dynamic(() => import('./StudioWorkspace'), {
  ssr: false,
  loading: () => <div className="grid min-h-dvh place-items-center text-muted-foreground">Opening canvas…</div>,
});

export default function StudioWorkspaceLoader({
  projectId,
  freeCreditModelsOnly,
}: {
  projectId: string;
  freeCreditModelsOnly: boolean;
}) {
  return (
    <StudioWorkspace
      projectId={projectId}
      freeCreditModelsOnly={freeCreditModelsOnly}
    />
  );
}
