'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react';

interface SoloWorkspaceProps {
  soloUrl: string;
}

export default function SoloWorkspace({ soloUrl }: SoloWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [frameKey, setFrameKey] = useState(0);

  function reload() {
    setLoading(true);
    setFrameKey((key) => key + 1);
  }

  return (
    <main className="solo-shell">
      <header className="solo-header">
        <div className="solo-header-left">
          <Link className="back" href="/" aria-label="Back to feed" title="Back to feed">
            <ArrowLeft aria-hidden="true" />
            <span>Back</span>
          </Link>
          <span className="solo-divider" />
          <div className="stitle">
            <span className="mark" />
            <span>Create</span>
          </div>
          <span className="solo-status">Solo workspace</span>
        </div>
        <div className="solo-actions">
          <button type="button" className="icon-button" onClick={reload} title="Reload Solo" aria-label="Reload Solo">
            <RefreshCw aria-hidden="true" />
          </button>
          <a
            className="solo-external"
            href={soloUrl}
            target="_blank"
            rel="noreferrer"
            title="Open Solo in a new tab"
          >
            <ExternalLink aria-hidden="true" />
            <span>Open separately</span>
          </a>
        </div>
      </header>

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
          onLoad={() => setLoading(false)}
        />
      </section>
    </main>
  );
}
