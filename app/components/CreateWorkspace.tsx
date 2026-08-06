'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Repeat2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import MediaUploader from './MediaUploader';
import SoloWorkspace from './SoloWorkspace';
import type { AppUser, Video } from '@/lib/types';

export type CreateMode = 'choose' | 'upload' | 'solo';

interface CreateWorkspaceProps {
  user: AppUser;
  soloUrl: string;
  // Posting is an overlay on whatever page opened it, so dismissing always
  // returns to that page rather than navigating anywhere.
  onClose: () => void;
  onPublished: (video: Video) => void;
}

const MODE_TITLE: Record<CreateMode, string> = {
  choose: 'Create',
  upload: 'Your own upload',
  solo: 'AI Studio',
};

export default function CreateWorkspace({
  user,
  soloUrl,
  onClose,
  onPublished,
}: CreateWorkspaceProps) {
  const [mode, setMode] = useState<CreateMode>('choose');
  const [frameKey, setFrameKey] = useState(0);

  function reloadFrame() {
    setFrameKey((key) => key + 1);
  }

  return (
    <div className="solo-shell">
      <header className="solo-header">
        <div className="solo-header-left">
          <button type="button" className="back" onClick={onClose} aria-label="Close" title="Close">
            <X aria-hidden="true" />
            <span>Close</span>
          </button>
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

              {/* No Solo API yet, so this hands off to their studio and takes the
                  finished file back through the uploader. */}
              <button type="button" className="pick-card" onClick={() => setMode('solo')}>
                <span className="pick-ic ai"><Sparkles aria-hidden="true" /></span>
                <b>Make it with AI</b>
                <small>Generate from a prompt in the Solo studio, then bring the file back here.</small>
                <span className="pick-go">
                  Open AI Studio
                  <ChevronRight aria-hidden="true" />
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {mode === 'upload' && <MediaUploader user={user} onPublished={onPublished} />}

      {mode === 'solo' && (
        <SoloWorkspace
          soloUrl={soloUrl}
          frameKey={frameKey}
          onUpload={() => setMode('upload')}
        />
      )}
    </div>
  );
}
