'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, LoaderCircle, Upload } from 'lucide-react';

// Solo sends no X-Frame-Options and no frame-ancestors CSP, but its app still
// paints nothing when it is not the top window — the iframe fires `load` and
// stays blank. Cross-origin gives us no way to see that, so the frame gets a
// grace period and then we offer the route that does work.
const EMBED_GRACE_MS = 3000;

type Phase = 'probing' | 'blocked' | 'embedded';

interface SoloWorkspaceProps {
  soloUrl: string;
  frameKey: number;
  onUpload: () => void;
}

export default function SoloWorkspace({ soloUrl, frameKey, onUpload }: SoloWorkspaceProps) {
  // Tie the outcome to the frame it belongs to, so bumping the key re-probes
  // without an effect having to reset state.
  const [resolved, setResolved] = useState<{ key: number; phase: Exclude<Phase, 'probing'> } | null>(
    null,
  );
  const phase: Phase = resolved?.key === frameKey ? resolved.phase : 'probing';

  useEffect(() => {
    const timer = window.setTimeout(
      () => setResolved({ key: frameKey, phase: 'blocked' }),
      EMBED_GRACE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [frameKey]);

  return (
    <section className="solo-frame" aria-busy={phase === 'probing'}>
      <iframe
        key={frameKey}
        src={soloUrl}
        title="Solo creation workspace"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads allow-modals"
        allow="clipboard-read; clipboard-write; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />

      {phase === 'probing' && (
        <div className="solo-loading" role="status">
          <LoaderCircle aria-hidden="true" />
          <span>Loading Solo...</span>
        </div>
      )}

      {phase === 'blocked' && (
        <div className="solo-blocked">
          <div className="solo-blocked-card">
            <h2>Solo won&apos;t run inside Snackd</h2>
            <p>
              Their studio refuses to draw itself in an embed, so it has to open in its own tab.
              Generate over there, then come straight back and upload the file — it publishes to
              your feed like any other post.
            </p>
            <div className="solo-blocked-actions">
              <a className="solo-external" href={soloUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                <span>Open Solo</span>
              </a>
              <button type="button" className="create-switch" onClick={onUpload}>
                <Upload aria-hidden="true" />
                <span>I have the file — upload it</span>
              </button>
            </div>
            <button
              type="button"
              className="solo-anyway"
              onClick={() => setResolved({ key: frameKey, phase: 'embedded' })}
            >
              Show the embed anyway
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
