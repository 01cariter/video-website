'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import SoloWorkspace from '../SoloWorkspace';
import { OPEN_COMPOSE_EVENT } from '../shell/compose-events';

interface StudioViewProps {
  soloUrl: string;
}

// CreatorStudio: the one surface that embeds Worksolo. Post never does —
// "I have the file" here hands off to the shell's own ComposeModal rather
// than rendering an uploader inline.
export default function StudioView({ soloUrl }: StudioViewProps) {
  const [frameKey, setFrameKey] = useState(0);

  function openCompose() {
    window.dispatchEvent(new CustomEvent(OPEN_COMPOSE_EVENT));
  }

  return (
    <div className="studio-view">
      <header className="studio-view-header">
        <div>
          <h1>CreatorStudio</h1>
          <p>Generate with Solo, then bring the finished file back here to post it.</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setFrameKey((key) => key + 1)}
          title="Reload Solo"
          aria-label="Reload Solo"
        >
          <RefreshCw aria-hidden="true" />
        </button>
      </header>
      <SoloWorkspace soloUrl={soloUrl} frameKey={frameKey} onUpload={openCompose} />
    </div>
  );
}
