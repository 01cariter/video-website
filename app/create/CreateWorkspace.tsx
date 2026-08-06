'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import MediaUploader from '@/app/components/MediaUploader';
import type { AppUser } from '@/lib/types';
import SoloWorkspace from './SoloWorkspace';

interface CreateWorkspaceProps {
  user: AppUser;
  soloUrl: string;
}

type CreateTab = 'upload' | 'solo';

export default function CreateWorkspace({ user, soloUrl }: CreateWorkspaceProps) {
  const [tab, setTab] = useState<CreateTab>('upload');
  const [frameLoading, setFrameLoading] = useState(true);
  const [frameKey, setFrameKey] = useState(0);

  function reloadFrame() {
    setFrameLoading(true);
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
          <div className="create-tabs" role="tablist" aria-label="Create mode">
            <button
              type="button"
              role="tab"
              className={tab === 'upload' ? 'on' : ''}
              aria-selected={tab === 'upload'}
              onClick={() => setTab('upload')}
            >
              Upload
            </button>
            <button
              type="button"
              role="tab"
              className={tab === 'solo' ? 'on' : ''}
              aria-selected={tab === 'solo'}
              onClick={() => setTab('solo')}
            >
              Solo workspace
            </button>
          </div>
        </div>

        {tab === 'solo' && (
          <div className="solo-actions">
            <button
              type="button"
              className="icon-button"
              onClick={reloadFrame}
              title="Reload Solo"
              aria-label="Reload Solo"
            >
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
        )}
      </header>

      {tab === 'upload' ? (
        <MediaUploader user={user} />
      ) : (
        <SoloWorkspace
          soloUrl={soloUrl}
          frameKey={frameKey}
          loading={frameLoading}
          onLoaded={() => setFrameLoading(false)}
        />
      )}
    </main>
  );
}
