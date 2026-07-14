'use client';

import { memo } from 'react';

import MediaNodeFrame from './MediaNodeFrame';

// ---------------------------------------------------------------------------
// Free-form AI canvas node. Every node is a "scene / shot" card that holds a
// prompt and, once generated, a poster + caption. Selection is driven by
// React Flow (.react-flow__node.selected), the bottom panel reads the data.
// ---------------------------------------------------------------------------

function SceneNode({ data }) {
  return <MediaNodeFrame kind="video" data={data} />;
}

// ---------------------------------------------------------------------------
// Image-generation node. A simpler card focused on text-to-image: prompt in,
// a real AI-generated still out. No duration / play overlay.
// ---------------------------------------------------------------------------

function ImageNode({ data }) {
  return <MediaNodeFrame kind="image" data={data} />;
}

export const nodeTypes = { scene: memo(SceneNode), image: memo(ImageNode) };

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

// Factory for a new blank image-generation node.
export function makeImageNode(partial = {}) {
  _seq += 1;
  const id = partial.id || `img_${Date.now().toString(36)}_${_seq}`;
  return {
    id,
    type: 'image',
    position: partial.position || { x: 120, y: 120 },
    data: {
      kind: 'image',
      title: partial.title || 'Image',
      prompt: partial.prompt || '',
      status: 'idle',
      poster: null,
      model: partial.model || 'imagen-4-fast',
      ratio: partial.ratio || '1:1',
      style: partial.style || 'cinematic',
      ...partial.data,
    },
  };
}
