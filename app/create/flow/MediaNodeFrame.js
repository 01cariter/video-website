'use client';

import { Handle, Position } from '@xyflow/react';
import {
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  Play,
  TriangleAlert,
  Video,
} from 'lucide-react';

function getAspectRatio(ratio, isImage) {
  if (ratio === '9:16') return '9 / 16';
  if (ratio === '1:1') return '1 / 1';
  return isImage ? '1 / 1' : '16 / 9';
}

export default function MediaNodeFrame({ kind, data }) {
  const isImage = kind === 'image';
  const status = data.status || 'idle';
  const EmptyIcon = isImage ? ImageIcon : Video;
  const hasResult = status === 'done' && Boolean(data.poster);
  const showEmpty = status === 'idle' || (status === 'done' && !data.poster);

  return (
    <div className={`media-node media-node--${kind} media-node--${status}`}>
      <Handle type="target" position={Position.Left} />

      <div className="media-node__label">
        <span>{data.title || (isImage ? 'Image' : 'Scene')}</span>
        {data.connected ? (
          <span className="media-node__connected" title="已连接参考节点">
            <Link2 aria-hidden="true" size={13} />
            <span className="sr-only">已连接参考节点</span>
          </span>
        ) : null}
      </div>

      <div
        className="media-node__surface"
        style={{ aspectRatio: getAspectRatio(data.ratio, isImage) }}
      >
        {hasResult ? (
          <img src={data.poster} alt={data.title || 'Generated media'} draggable={false} />
        ) : null}

        {hasResult && !isImage ? (
          <span className="media-node__play" aria-hidden="true">
            <Play size={18} fill="currentColor" />
          </span>
        ) : null}

        {hasResult && !isImage ? (
          <span className="media-node__duration">{data.duration || '5s'}</span>
        ) : null}

        {status === 'running' ? (
          <span className="media-node__state" role="status">
            <LoaderCircle className="is-spinning" aria-hidden="true" />
            <small>生成中</small>
          </span>
        ) : null}

        {status === 'error' ? (
          <span className="media-node__state media-node__state--error" role="alert">
            <TriangleAlert aria-hidden="true" />
            <small>{data.error || '生成失败'}</small>
          </span>
        ) : null}

        {showEmpty ? <EmptyIcon className="media-node__empty-icon" aria-hidden="true" /> : null}
      </div>

      {data.caption || data.prompt ? (
        <p className="media-node__caption">{data.caption || data.prompt}</p>
      ) : null}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
