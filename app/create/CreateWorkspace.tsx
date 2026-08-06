'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Repeat2,
  Sparkles,
  Upload,
} from 'lucide-react';

function soloHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Solo';
  }
}
import MediaUploader from '@/app/components/MediaUploader';
import type { AppUser } from '@/lib/types';
import SoloWorkspace from './SoloWorkspace';

export type CreateMode = 'choose' | 'upload' | 'solo';

interface CreateWorkspaceProps {
  user: AppUser;
  soloUrl: string;
  initialMode?: CreateMode;
}

const MODE_TITLE: Record<CreateMode, string> = {
  choose: 'Create',
  upload: 'Your own upload',
  solo: 'AI Studio',
};

export default function CreateWorkspace({
  user,
  soloUrl,
  initialMode = 'choose',
}: CreateWorkspaceProps) {
  const [mode, setMode] = useState<CreateMode>(initialMode);
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
            <span>{MODE_TITLE[mode]}</span>
          </div>
          {mode !== 'choose' && (
            <button type="button" className="create-switch" onClick={() => setMode('choose')}>
              <Repeat2 aria-hidden="true" />
              <span>Switch</span>
            </button>
          )}
        </div>

        {mode === 'solo' && (
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

      {mode === 'choose' && (
        <section className="pick">
          <div className="pick-inner">
            <h1>What are you posting?</h1>
            <p className="pick-lead">Bring your own files, or make something new with AI.</p>

            <div className="pick-options">
              <button type="button" className="pick-card" onClick={() => setMode('upload')}>
                <span className="pick-ic own"><Upload aria-hidden="true" /></span>
                <b>I have my own</b>
                <small>Upload a photo or video from this device. Straight to the feed.</small>
                <span className="pick-go">
                  Upload files
                  <ChevronRight aria-hidden="true" />
                </span>
              </button>

              {/* No Solo API yet, so this is just a link out to their site. */}
              <a className="pick-card" href={soloUrl} target="_blank" rel="noreferrer">
                <span className="pick-ic ai"><Sparkles aria-hidden="true" /></span>
                <b>Make it with AI</b>
                <small>Generate it on Solo, then come back and upload the result here.</small>
                <span className="pick-go">
                  Open {soloHost(soloUrl)}
                  <ExternalLink aria-hidden="true" />
                </span>
              </a>
            </div>
          </div>
        </section>
      )}

      {mode === 'upload' && <MediaUploader user={user} />}

      {mode === 'solo' && (
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
