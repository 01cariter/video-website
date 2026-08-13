'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useReactFlow, useStore } from '@xyflow/react';
import {
  Copy,
  FileText,
  Hand,
  ImageIcon,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Trash2,
  Type,
  Video,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudioNodeData, StudioNodeKind } from '@/lib/studio/types';
import { isGeneratorNode } from '@/lib/studio/geometry';
import { studioSnap } from '@/lib/studio/motion';
import { useStudioCanvas } from './studio-context';
import NodeInspector from './NodeInspector';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip';

const KIND_META: Record<StudioNodeKind, { label: string; icon: typeof ImageIcon }> = {
  image: { label: '图片生成', icon: ImageIcon },
  video: { label: '视频生成', icon: Video },
  text: { label: '文本', icon: Type },
};

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function ToolButton({
  label,
  shortcut,
  pressed,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  pressed?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          aria-pressed={pressed}
          className={cn('size-6 rounded-md [&_svg]:size-3', pressed && 'bg-accent text-accent-foreground')}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {label}
        {shortcut ? <span className="ml-1.5 text-muted-foreground">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function LeftToolbar() {
  const { addNode, tool, setTool } = useStudioCanvas();
  const { fitView } = useReactFlow();

  return (
    <TooltipProvider delayDuration={240}>
      <div className="flex flex-col items-center gap-px rounded-lg bg-card/90 p-0.5 shadow-[0_8px_18px_-14px_color-mix(in_srgb,var(--ink)_50%,transparent)] backdrop-blur-md">
        <ToolButton label="选择" shortcut="V" pressed={tool === 'select'} onClick={() => setTool('select')}>
          <MousePointer2 />
        </ToolButton>
        <ToolButton label="平移" shortcut="H" pressed={tool === 'pan'} onClick={() => setTool('pan')}>
          <Hand />
        </ToolButton>
        <span className="my-px h-px w-3 bg-border" aria-hidden />
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-xs" className="size-6 rounded-md [&_svg]:size-3" aria-label="添加节点">
                  <Plus />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">添加节点</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem onSelect={() => addNode('image')}>
              <ImageIcon /> 图片生成器
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addNode('video')}>
              <Video /> 视频生成器
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addNode('text')}>
              <FileText /> 文本
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="my-px h-px w-3 bg-border" aria-hidden />
        <ToolButton label="适应画布" onClick={() => void fitView({ padding: 0.18, duration: 180 })}>
          <Maximize2 />
        </ToolButton>
      </div>
    </TooltipProvider>
  );
}

export function ZoomControl() {
  const { zoomIn, zoomOut, zoomTo } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const percent = Math.round(zoom * 100);

  return (
    <div className="flex items-center text-muted-foreground" role="group" aria-label="画布缩放">
      <button
        type="button"
        className="grid size-5 place-items-center rounded-sm hover:bg-accent/70 hover:text-foreground"
        aria-label="缩小"
        onClick={() => void zoomOut({ duration: 120 })}
      >
        <Minus className="size-2.5" />
      </button>
      <button
        type="button"
        className="min-w-7 px-0.5 text-center !text-[10px] font-medium tabular-nums hover:text-foreground"
        aria-label="重置为 100%"
        onClick={() => void zoomTo(1, { duration: 160 })}
      >
        {percent}%
      </button>
      <button
        type="button"
        className="grid size-5 place-items-center rounded-sm hover:bg-accent/70 hover:text-foreground"
        aria-label="放大"
        onClick={() => void zoomIn({ duration: 120 })}
      >
        <Plus className="size-2.5" />
      </button>
    </div>
  );
}

export function NodeOverlays({ stageRef }: { stageRef: React.RefObject<HTMLDivElement | null> }) {
  const { generateNode, duplicateNode, removeNode, updateNodeData, setNodeAspect } = useStudioCanvas();
  const flowNodes = useStore((state) => state.nodes);
  const nodeLookup = useStore((state) => state.nodeLookup);
  const transform = useStore((state) => state.transform);
  const selectedId = useStore((state) => state.nodes.find((node) => node.selected)?.id ?? null);
  const nodes = useMemo(
    () => flowNodes.map((node) => nodeLookup.get(node.id)).filter((node) => Boolean(node)),
    [flowNodes, nodeLookup],
  );
  const inspectorRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const [inspectorBox, setInspectorBox] = useState({ w: 520, h: 148 });
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = overlayRef.current?.parentElement || stageRef.current;
    if (!el) return;
    const update = () => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stageRef, flowNodes.length]);

  useLayoutEffect(() => {
    const el = inspectorRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width && rect.height) setInspectorBox({ w: rect.width, h: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedId]);

  const stageW = stageSize.w;
  const stageH = stageSize.h;
  const pad = 10;
  const selected = selectedId ? nodeLookup.get(selectedId) : undefined;
  const selectedData = selected?.data as StudioNodeData | undefined;
  const generator = selectedData ? isGeneratorNode(selectedData) : false;
  let chrome = { left: 0, top: 0, visible: false };

  if (selected && selectedData && selectedData.status !== 'generating' && stageW && stageH) {
    const [panX, panY, zoom] = transform;
    const pos = selected.internals.positionAbsolute;
    const width = (selected.measured.width ?? selected.width ?? 280) * zoom;
    const height = (selected.measured.height ?? selected.height ?? 280) * zoom;
    const left = pos.x * zoom + panX;
    const top = pos.y * zoom + panY;
    const inside = left + width > 0 && left < stageW && top + height > 0 && top < stageH;
    if (inside) {
      const tw = inspectorBox.w;
      const th = inspectorBox.h;
      chrome = generator
        ? {
            left: clamp(left + width / 2 - tw / 2, pad, Math.max(pad, stageW - tw - pad)),
            top: clamp(top + height + 10, pad, Math.max(pad, stageH - th - pad)),
            visible: true,
          }
        : {
            left: clamp(left + width / 2 - tw / 2, pad, Math.max(pad, stageW - tw - pad)),
            top: clamp(top - th - 12, pad, Math.max(pad, stageH - th - pad)),
            visible: true,
          };
    }
  }

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-[4]" aria-hidden={!chrome.visible}>
      {nodes.map((node) => {
        if (!node) return null;
        const kind = (node.type || node.data.kind) as StudioNodeKind;
        const meta = KIND_META[kind] || KIND_META.image;
        const Icon = meta.icon;
        const [panX, panY, zoom] = transform;
        const pos = node.internals.positionAbsolute;
        const width = (node.measured.width ?? node.width ?? 280) * zoom;
        const height = (node.measured.height ?? node.height ?? 280) * zoom;
        const left = pos.x * zoom + panX + 2;
        const top = pos.y * zoom + panY - 18;
        const visible = stageW === 0 || stageH === 0 || (left < stageW && top + 16 < stageH && left + width > 0 && top + height > 0);
        if (!visible) return null;
        return (
          <div
            key={node.id}
            className="absolute top-0 left-0 inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] font-medium leading-none text-muted-foreground [text-shadow:0_1px_1px_var(--cream)]"
            style={{ transform: `translate(${left}px, ${top}px)` }}
          >
            <Icon className="size-2.5 opacity-70" />
            <span>{String(node.data.title || meta.label)}</span>
          </div>
        );
      })}
      <AnimatePresence>
        {selected && selectedData && selectedData.status !== 'generating' ? (
          <div
            key={`${selected.id}-${generator ? 'gen' : 'tool'}`}
            ref={inspectorRef}
            className="absolute top-0 left-0 pointer-events-auto"
            style={{
              transform: `translate(${chrome.left}px, ${chrome.top}px)`,
              visibility: chrome.visible ? 'visible' : 'hidden',
            }}
          >
            {generator ? (
              <NodeInspector
                kind={selectedData.kind}
                data={selectedData}
                canSubmit={String(selectedData.prompt || '').trim().length > 0}
                onPromptChange={(value) => updateNodeData(selected.id, { prompt: value })}
                onFieldChange={(key, value) => updateNodeData(selected.id, { [key]: value })}
                onAspectChange={(aspect) => setNodeAspect(selected.id, aspect)}
                onRefChange={(src) => updateNodeData(selected.id, { refSrc: src })}
                onSubmit={() => void generateNode(selected.id)}
              />
            ) : (
              <motion.div
                className="inline-flex items-center gap-0.5 rounded-full bg-card/90 p-1 shadow-[0_14px_32px_-24px_color-mix(in_srgb,var(--ink)_55%,transparent)] backdrop-blur-xl"
                initial={reduceMotion ? false : { opacity: 0, y: 5, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 4, scale: 0.97 }}
                transition={studioSnap}
              >
                <Button type="button" variant="ghost" size="sm" onClick={() => void generateNode(selected.id)}>
                  <Wand2 /> 重新生成
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => duplicateNode(selected.id)}>
                  <Copy /> 复制
                </Button>
                <Button type="button" variant="ghost" size="sm" className="hover:bg-accent hover:text-accent-foreground" onClick={() => removeNode(selected.id)}>
                  <Trash2 /> 删除
                </Button>
              </motion.div>
            )}
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
