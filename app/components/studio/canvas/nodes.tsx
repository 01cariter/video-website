'use client';

import { useEffect, useState } from 'react';
import { Frame, Img, Rect, Txt } from '@/lib/leafer-react';
import type { StudioNode } from '@/lib/studio/types';

const NODE_FILL = '#f4f4f2';
const NODE_STROKE = '#d7d7d2';
const NODE_RADIUS = 6;
const NODE_EDIT_CONFIG = { rotateable: false };

export function StudioCanvasNode({ node }: { node: StudioNode }) {
  const locked = node.data.locked === true;
  const visible = node.data.hidden !== true;
  const data = { nodeId: node.id };

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
      draggable={!locked}
      editable={!locked}
      editConfig={NODE_EDIT_CONFIG}
      locked={locked}
      isSnap
      lockRatio={node.type === 'image' || node.type === 'video'}
      resizeChildren
      data={data}
    >
      <NodeBody node={node} data={data} />
    </Frame>
  );
}

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
          fill="rgba(255,255,255,0.16)"
          stroke="#bdbab1"
          strokeWidth={1}
          dashPattern={[8, 6]}
          cornerRadius={4}
          hittable
          data={data}
        />
        <Txt
          text={node.data.title || '分组'}
          x={12}
          y={-24}
          width={Math.max(80, node.width - 24)}
          fontSize={12}
          fontWeight={600}
          fill="#6f6b62"
          hittable={false}
          data={data}
        />
      </>
    );
  }

  if (node.data.status === 'generating') {
    return <GeneratingNode node={node} data={data} />;
  }

  if (node.type === 'image') {
    return (
      <>
        <Rect
          x={0}
          y={0}
          width={node.width}
          height={node.height}
          fill="#171613"
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
          <EmptyNode node={node} label="图片" data={data} />
        )}
      </>
    );
  }

  if (node.type === 'video') {
    return (
      <>
        <Rect
          x={0}
          y={0}
          width={node.width}
          height={node.height}
          fill="#171613"
          stroke={NODE_STROKE}
          strokeWidth={1}
          cornerRadius={NODE_RADIUS}
          data={data}
        />
        <Txt
          text={node.data.src ? '▶  视频已生成' : node.data.error || '视频'}
          x={0}
          y={Math.max(0, node.height / 2 - 11)}
          width={node.width}
          fontSize={13}
          fontWeight={600}
          textAlign="center"
          fill={node.data.error ? '#e56969' : '#ddd8cf'}
          hittable={false}
          data={data}
        />
        {node.data.src ? (
          <Txt
            text="双击或使用菜单播放"
            x={0}
            y={Math.max(0, node.height / 2 + 14)}
            width={node.width}
            fontSize={10}
            textAlign="center"
            fill="#8d887f"
            hittable={false}
            data={data}
          />
        ) : null}
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
        text={node.data.title || '文本'}
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
        text={node.data.text || node.data.error || '双击或在下方输入文案要求'}
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
        fill={node.data.error ? '#b94e4e' : '#c2c2bd'}
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
        fill={node.data.error ? '#b94e4e' : '#888882'}
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
  const progress = useLoadingSweep();
  const bandWidth = Math.max(72, Math.min(180, node.width * 0.42));
  const x = Math.max(
    0,
    Math.min(node.width, progress * node.width) - bandWidth / 2,
  );
  return (
    <>
      <Rect
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        fill={NODE_FILL}
        stroke={NODE_STROKE}
        strokeWidth={1}
        cornerRadius={NODE_RADIUS}
        data={data}
      />
      <Rect
        x={x}
        y={0}
        width={Math.min(bandWidth, node.width - x)}
        height={node.height}
        fill="rgba(255,255,255,0.48)"
        cornerRadius={NODE_RADIUS}
        hittable={false}
        data={data}
      />
      <Txt
        text={
          node.type === 'video'
            ? '正在生成视频'
            : node.type === 'text'
              ? '正在写作'
              : '正在生成图片'
        }
        x={12}
        y={Math.max(0, node.height / 2 - 10)}
        width={Math.max(24, node.width - 24)}
        fontSize={12}
        fontWeight={600}
        textAlign="center"
        fill="#77736b"
        hittable={false}
        data={data}
      />
    </>
  );
}

function useLoadingSweep() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (time: number) => {
      setProgress(((time - start) % 1400) / 1400);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return progress;
}
