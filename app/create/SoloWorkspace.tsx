'use client';

import { LoaderCircle } from 'lucide-react';

interface SoloWorkspaceProps {
  soloUrl: string;
  frameKey: number;
  loading: boolean;
  onLoaded: () => void;
}

export default function SoloWorkspace({ soloUrl, frameKey, loading, onLoaded }: SoloWorkspaceProps) {
  return (
    <section className="solo-frame" aria-busy={loading}>
      {loading && (
        <div className="solo-loading" role="status">
          <LoaderCircle aria-hidden="true" />
          <span>Loading Solo...</span>
        </div>
      )}
      <iframe
        key={frameKey}
        src={soloUrl}
        title="Solo creation workspace"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads allow-modals"
        allow="clipboard-read; clipboard-write; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={onLoaded}
      />
    </section>
  );
}
