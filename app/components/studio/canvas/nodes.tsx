'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type NodeProps } from '@xyflow/react';
import type { StudioNode, StudioNodeKind } from '@/lib/studio/types';

import { studioSnap, studioTween } from '@/lib/studio/motion';
import { cn } from '@/lib/utils';
import GenerationLoader from './GenerationLoader';

function NodeShell({ selected, children }: { selected?: boolean; children: React.ReactNode }) {
  const reduceMotion = Boolean(useReducedMotion());
  return (
    <motion.div
      className={cn(
        'h-full overflow-hidden rounded-[8px] shadow-none',
        selected && 'outline-2 outline-offset-0 outline-[var(--orange)]',
      )}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={studioSnap}
    >
      {children}
    </motion.div>
  );
}

function NodeStage({ stage, children }: { stage: string; children: React.ReactNode }) {
  const reduceMotion = Boolean(useReducedMotion());
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stage}
        className="h-full"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={studioTween}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

const EMPTY_COPY: Record<StudioNodeKind, string> = {
  image: '画面',
  video: '镜头',
  text: '文案',
};

function EmptyStage({
  kind,
  aspect,
  error,
}: {
  kind: StudioNodeKind;
  aspect?: string;
  error?: string;
}) {
  return (
    <div className="relative grid h-full place-items-center border border-[var(--line)] bg-[var(--panel)]">
      <span aria-hidden className="pointer-events-none absolute inset-2.5 text-[var(--line)]">
        <i className="absolute top-0 left-0 size-2.5 border-t border-l" />
        <i className="absolute top-0 right-0 size-2.5 border-t border-r" />
        <i className="absolute bottom-0 left-0 size-2.5 border-b border-l" />
        <i className="absolute bottom-0 right-0 size-2.5 border-b border-r" />
      </span>
      <div className="grid justify-items-center gap-1 px-3 text-center">
        {error ? (
          <p className="max-w-[18ch] text-[11px] leading-snug font-medium text-destructive">{error}</p>
        ) : (
          <>
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground">{EMPTY_COPY[kind]}</span>
            {kind !== 'text' && aspect && aspect !== 'auto' ? (
              <span className="text-[10px] tabular-nums text-muted-foreground/70">{aspect}</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function ImageGenNode({ data, selected }: NodeProps<StudioNode>) {
  return (
    <NodeShell selected={selected}>
      <NodeStage stage={data.status === 'generating' ? 'generating' : data.src ? 'ready' : 'idle'}>
        {data.status === 'generating' ? (
          <GenerationLoader prompt={data.prompt} resolution={data.aspect || '1:1'} label="正在生成图片" />
        ) : data.src ? (
          <img className="block h-full w-full bg-[#171613] object-cover" src={data.src} alt={data.title} />
        ) : (
          <EmptyStage kind="image" aspect={data.aspect} error={data.error} />
        )}
      </NodeStage>
    </NodeShell>
  );
}

export function VideoGenNode({ data, selected }: NodeProps<StudioNode>) {
  return (
    <NodeShell selected={selected}>
      <NodeStage stage={data.status === 'generating' ? 'generating' : data.src ? 'ready' : 'idle'}>
        {data.status === 'generating' ? (
          <GenerationLoader prompt={data.prompt} resolution={`${data.videoResolution || '720p'} · ${data.duration || 5}s`} label="正在生成视频" />
        ) : data.src ? (
          <video className="block h-full w-full bg-[#171613] object-cover" src={data.src} controls playsInline />
        ) : (
          <EmptyStage kind="video" aspect={data.aspect} error={data.error} />
        )}
      </NodeStage>
    </NodeShell>
  );
}

export function TextGenNode({ data, selected }: NodeProps<StudioNode>) {
  return (
    <NodeShell selected={selected}>
      <NodeStage stage={data.status === 'generating' ? 'generating' : data.text ? 'ready' : 'idle'}>
        {data.status === 'generating' ? (
          <div className="grid h-full place-items-center bg-[var(--panel)] text-[13px] font-semibold text-muted-foreground">正在写…</div>
        ) : data.text ? (
          <div className="h-full overflow-auto border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap">
            {data.text}
          </div>
        ) : (
          <EmptyStage kind="text" error={data.error} />
        )}
      </NodeStage>
    </NodeShell>
  );
}

export const studioNodeTypes = {
  image: ImageGenNode,
  video: VideoGenNode,
  text: TextGenNode,
};
