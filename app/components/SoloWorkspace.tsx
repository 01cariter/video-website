'use client';

interface SoloWorkspaceProps {
  soloUrl: string;
  frameKey?: number;
}

/** Full-bleed Worksolo iframe — no blocked overlay, no chrome. */
export default function SoloWorkspace({ soloUrl, frameKey = 0 }: SoloWorkspaceProps) {
  return (
    <section className="solo-frame">
      <iframe
        key={frameKey}
        src={soloUrl}
        title="Solo creation workspace"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads allow-modals"
        allow="clipboard-read; clipboard-write; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </section>
  );
}
