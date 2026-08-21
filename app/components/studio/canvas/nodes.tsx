'use client';

import { memo, useEffect, useRef } from 'react';
import type { IUI } from 'leafer-editor';
import { Frame, Img, Rect, Txt } from '@/lib/leafer-react';
import type { StudioNode } from '@/lib/studio/types';

const NODE_FILL = '#f8f3ec';
const NODE_STROKE = '#d9cec1';
const NODE_RADIUS = 6;
const NODE_EDIT_CONFIG = { rotateable: false };

export const StudioCanvasNode = memo(function StudioCanvasNode({
  node,
}: {
  node: StudioNode;
}) {
  const locked = node.data.locked === true;
  const visible = node.data.hidden !== true;
  const data = { nodeId: node.id };
  const contentKey = [
    node.data.status,
    node.data.src ? 'asset' : 'empty',
    node.data.posterSrc ? 'poster' : 'no-poster',
    node.data.error ? 'error' : 'ok',
  ].join(':');

  return (
    <Frame
      id={node.id}
      name={node.data.title}
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      rotation={0}
      zIndex={node.type === 'section' ? Math.min(-1, node.zIndex) : node.zIndex}
      visible={visible}
      fill="transparent"
      strokeWidth={0}
      cornerRadius={node.type === 'section' ? 0 : NODE_RADIUS}
      overflow={node.type === 'section' ? 'show' : 'hide'}
      draggable={!locked}
      editable={!locked}
      editConfig={NODE_EDIT_CONFIG}
      locked={locked}
      isSnap
      lockRatio={node.type === 'image' || node.type === 'video'}
      resizeChildren
      data={data}
    >
      <NodeBody key={contentKey} node={node} data={data} />
    </Frame>
  );
});

function NodeBody({
  node,
  data,
}: {
  node: StudioNode;
  data: Record<string, unknown>;
}) {
  if (node.type === 'section') {
    return (
      <>
        <Rect
          x={0}
          y={0}
          width={node.width}
          height={node.height}
          fill="rgba(70,121,137,0.07)"
          stroke="#9fb8bf"
          strokeWidth={1}
          dashPattern={[8, 6]}
          cornerRadius={4}
          hittable
          data={data}
        />
        <Txt
          text={node.data.title || 'Group'}
          x={12}
          y={-24}
          width={Math.max(80, node.width - 24)}
          fontSize={12}
          fontWeight={600}
          fill="#467989"
          hittable={false}
          data={data}
        />
      </>
    );
  }

  if (node.data.status === 'generating') {
    return <GeneratingNode node={node} data={data} />;
  }

  if (node.data.status === 'uploading') {
    return <UploadingNode node={node} data={data} />;
  }

  if (node.type === 'image') {
    return (
      <>
        <Rect
          x={0}
          y={0}
          width={node.width}
          height={node.height}
          fill="#eee8df"
          stroke={NODE_STROKE}
          strokeWidth={1}
          cornerRadius={NODE_RADIUS}
          data={data}
        />
        {node.data.src ? (
          <Img
            url={node.data.src}
            x={0}
            y={0}
            width={node.width}
            height={node.height}
            cornerRadius={NODE_RADIUS}
            draggable={false}
            data={data}
          />
        ) : (
          <EmptyNode node={node} label="Image" data={data} />
        )}
      </>
    );
  }

  if (node.type === 'video') {
    const posterSrc =
      typeof node.data.posterSrc === 'string' ? node.data.posterSrc : undefined;
    return (
      <>
        <Rect
          x={0}
          y={0}
          width={node.width}
          height={node.height}
          fill="#f1ece5"
          stroke={NODE_STROKE}
          strokeWidth={1}
          cornerRadius={NODE_RADIUS}
          data={data}
        />
        {posterSrc ? (
          <Img
            url={posterSrc}
            x={0}
            y={0}
            width={node.width}
            height={node.height}
            cornerRadius={NODE_RADIUS}
            draggable={false}
            data={data}
          />
        ) : null}
        {node.data.src && posterSrc ? (
          <>
            <Rect
              x={Math.max(8, node.width / 2 - 22)}
              y={Math.max(8, node.height / 2 - 22)}
              width={44}
              height={44}
              fill="rgba(255,253,249,0.88)"
              stroke="rgba(77,65,56,0.16)"
              strokeWidth={1}
              cornerRadius={22}
              hittable={false}
              data={data}
            />
            <Txt
              text="▶"
              x={Math.max(8, node.width / 2 - 19)}
              y={Math.max(8, node.height / 2 - 10)}
              width={40}
              fontSize={16}
              textAlign="center"
              fill="#51473f"
              hittable={false}
              data={data}
            />
          </>
        ) : (
          <>
            <Txt
              text={node.data.error ? '!' : '▷'}
              x={12}
              y={Math.max(0, node.height / 2 - 30)}
              width={Math.max(24, node.width - 24)}
              fontSize={24}
              fontWeight={500}
              textAlign="center"
              fill={node.data.error ? '#b94e4e' : '#a27962'}
              hittable={false}
              data={data}
            />
            <Txt
              text={node.data.error || (node.data.src ? 'Video ready' : 'Video')}
              x={12}
              y={Math.max(0, node.height / 2 + 7)}
              width={Math.max(24, node.width - 24)}
              fontSize={11}
              fontWeight={600}
              textAlign="center"
              fill={node.data.error ? '#b94e4e' : '#75685f'}
              hittable={false}
              data={data}
            />
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        fill="#fff7c8"
        stroke="#e5d981"
        strokeWidth={1}
        cornerRadius={NODE_RADIUS}
        data={data}
      />
      <Txt
        text={node.data.title || 'Text'}
        x={14}
        y={12}
        width={Math.max(24, node.width - 28)}
        fontSize={11}
        fontWeight={600}
        fill="#85771b"
        hittable={false}
        data={data}
      />
      <Txt
        text={node.data.text || node.data.error || 'Double-click or enter a writing prompt below'}
        x={14}
        y={38}
        width={Math.max(24, node.width - 28)}
        height={Math.max(24, node.height - 52)}
        fontSize={14}
        lineHeight={20}
        fill={node.data.error ? '#a63f3f' : '#292616'}
        hittable={false}
        data={data}
      />
    </>
  );
}

function EmptyNode({
  node,
  label,
  data,
}: {
  node: StudioNode;
  label: string;
  data: Record<string, unknown>;
}) {
  return (
    <>
      <Rect
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        fill={NODE_FILL}
        stroke={node.data.error ? '#d76d6d' : NODE_STROKE}
        strokeWidth={1}
        cornerRadius={NODE_RADIUS}
        data={data}
      />
      <Txt
        text={node.data.error ? '!' : '▧'}
        x={12}
        y={Math.max(0, node.height / 2 - 28)}
        width={Math.max(24, node.width - 24)}
        fontSize={22}
        fontWeight={500}
        textAlign="center"
        fill={node.data.error ? '#b94e4e' : '#c7a58e'}
        hittable={false}
        data={data}
      />
      <Txt
        text={node.data.error || label}
        x={12}
        y={Math.max(0, node.height / 2 + 8)}
        width={Math.max(24, node.width - 24)}
        fontSize={11}
        fontWeight={600}
        textAlign="center"
        fill={node.data.error ? '#b94e4e' : '#75685f'}
        hittable={false}
        data={data}
      />
    </>
  );
}

function GeneratingNode({
  node,
  data,
}: {
  node: StudioNode;
  data: Record<string, unknown>;
}) {
  const sweepRef = useRef<IUI | null>(null);
  const bandWidth = Math.max(96, Math.min(220, node.width * 0.58));

  useEffect(() => {
    const sweep = sweepRef.current as
      | (IUI & { forceUpdate?: () => void })
      | null;
    if (!sweep) return;
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduceMotion) {
      sweep.x = (node.width - bandWidth) / 2;
      sweep.forceUpdate?.();
      return;
    }
    let frame = 0;
    const start = performance.now();
    const distance = node.width + bandWidth * 2;
    const tick = (time: number) => {
      const progress = ((time - start) % 2400) / 2400;
      sweep.x = -bandWidth + progress * distance;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [bandWidth, node.width]);

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        fill="#f2ede6"
        stroke={NODE_STROKE}
        strokeWidth={1}
        cornerRadius={NODE_RADIUS}
        data={data}
      />
      <Rect
        x={-bandWidth}
        y={0}
        width={bandWidth}
        height={node.height}
        fill={{
          type: 'linear',
          from: 'left',
          to: 'right',
          stops: [
            { offset: 0, color: 'rgba(255,255,255,0)' },
            { offset: 0.28, color: 'rgba(255,255,255,0.04)' },
            { offset: 0.5, color: 'rgba(255,255,255,0.42)' },
            { offset: 0.72, color: 'rgba(255,250,243,0.08)' },
            { offset: 1, color: 'rgba(255,255,255,0)' },
          ],
        }}
        hittable={false}
        data={data}
        onCreated={(instance: IUI) => {
          sweepRef.current = instance;
        }}
      />
      <Txt
        text={
          node.type === 'video'
            ? 'Generating video'
            : node.type === 'text'
              ? 'Writing'
              : 'Generating image'
        }
        x={12}
        y={Math.max(0, node.height / 2 - 10)}
        width={Math.max(24, node.width - 24)}
        fontSize={12}
        fontWeight={600}
        textAlign="center"
        fill="#75685f"
        hittable={false}
        data={data}
      />
    </>
  );
}

function UploadingNode({
  node,
  data,
}: {
  node: StudioNode;
  data: Record<string, unknown>;
}) {
  const posterSrc =
    typeof node.data.posterSrc === 'string' ? node.data.posterSrc : undefined;
  return (
    <>
      <Rect
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        fill="#f4f1eb"
        stroke="#9eb2ad"
        strokeWidth={1}
        dashPattern={[7, 5]}
        cornerRadius={NODE_RADIUS}
        data={data}
      />
      {posterSrc ? (
        <>
          <Img
            url={posterSrc}
            x={0}
            y={0}
            width={node.width}
            height={node.height}
            opacity={0.64}
            cornerRadius={NODE_RADIUS}
            draggable={false}
            data={data}
          />
          <Rect
            x={0}
            y={0}
            width={node.width}
            height={node.height}
            fill="rgba(247,244,238,0.38)"
            cornerRadius={NODE_RADIUS}
            hittable={false}
            data={data}
          />
        </>
      ) : null}
      <Txt
        text={`Uploading ${node.type === 'video' ? 'video' : 'image'}`}
        x={12}
        y={Math.max(0, node.height / 2 + 6)}
        width={Math.max(24, node.width - 24)}
        fontSize={11}
        fontWeight={600}
        textAlign="center"
        fill="#536963"
        hittable={false}
        data={data}
      />
    </>
  );
}
