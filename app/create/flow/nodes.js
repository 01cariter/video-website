'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

// ---------------------------------------------------------------------------
// Free-form AI canvas node. Every node is a "scene / shot" card that holds a
// prompt and, once generated, a poster + caption. Selection is driven by
// React Flow (.react-flow__node.selected), the bottom panel reads the data.
// ---------------------------------------------------------------------------

function SceneNode({ data }) {
  const { title, prompt, status = 'idle', poster, caption, ratio = '16:9', duration = '5s' } = data;
  const aspect = ratio === '9:16' ? '9 / 16' : ratio === '1:1' ? '1 / 1' : '16 / 9';

  return (
    <div className={`scn scn-${status}`}>
      <Handle type="target" position={Position.Left} />
      <div className="scn-head">
        <span className="scn-title">{title || 'Scene'}</span>
        <span className={`scn-badge ${status}`}>
          {status === 'running' ? 'Generating' : status === 'done' ? 'Ready' : 'Draft'}
        </span>
      </div>

      <div className="scn-media" style={{ aspectRatio: aspect }}>
        {status === 'done' && poster ? (
          <>
            <img src={poster} alt={title || 'result'} draggable={false} />
            <span className="scn-play">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <span className="scn-dur">{duration}</span>
          </>
        ) : status === 'running' ? (
          <div className="scn-loading">
            <span className="scn-spin" />
            <span className="scn-loading-txt">Generating…</span>
          </div>
        ) : (
          <div className="scn-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M10 9l5 3-5 3z" />
            </svg>
          </div>
        )}
      </div>

      <div className="scn-body">
        <p className="scn-prompt">{caption || prompt || 'No prompt yet — select and describe below.'}</p>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const nodeTypes = { scene: memo(SceneNode) };

// Factory for a new blank scene node.
let _seq = 0;
export function makeSceneNode(partial = {}) {
  _seq += 1;
  const id = partial.id || `n_${Date.now().toString(36)}_${_seq}`;
  return {
    id,
    type: 'scene',
    position: partial.position || { x: 120, y: 120 },
    data: {
      title: partial.title || 'Scene',
      prompt: partial.prompt || '',
      status: 'idle',
      poster: null,
      caption: '',
      model: partial.model || 'runway-gen3',
      mode: partial.mode || '文生视频',
      ratio: partial.ratio || '16:9',
      duration: partial.duration || '5s',
      ...partial.data,
    },
  };
}
