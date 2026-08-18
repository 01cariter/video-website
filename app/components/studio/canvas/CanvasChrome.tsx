'use client';

import {
  Copy,
  Hand,
  ImageIcon,
  Layers3,
  Lock,
  LockOpen,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  RectangleHorizontal,
  Trash2,
  Type,
  Video,
  Wand2,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type {
  StudioGenerativeKind,
  StudioNode,
  StudioNodeKind,
} from '@/lib/studio/types';
import { isGeneratorNode } from '@/lib/studio/geometry';
import { studioSnap } from '@/lib/studio/motion';
import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import NodeInspector from './NodeInspector';
import { useStudioCanvas } from './studio-context';
import type { StudioFloatingRect } from './useLeaferStudioRuntime';

const KIND_META: Record<StudioNodeKind, { label: string; icon: typeof ImageIcon }> =
  {
    image: { label: '图片生成', icon: ImageIcon },
    video: { label: '视频生成', icon: Video },
    text: { label: '文本', icon: Type },
    section: { label: '分组', icon: RectangleHorizontal },
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
          className={cn(
            'size-8 rounded-md [&_svg]:size-[15px]',
            pressed &&
              '!bg-primary !text-primary-foreground hover:!bg-primary/90 hover:!text-primary-foreground',
          )}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
        {shortcut ? (
          <span className="ml-1.5 text-muted-foreground">{shortcut}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function LeftToolbar({
  layersOpen,
  onToggleLayers,
}: {
  layersOpen: boolean;
  onToggleLayers: () => void;
}) {
  const { addNode, tool, setTool, fitView } = useStudioCanvas();

  return (
    <TooltipProvider delayDuration={160}>
      <div
        data-moodboard-floating-occluder
        className="flex items-center gap-0.5 rounded-lg border border-border bg-card/95 p-0.5 shadow-[0_1px_2px_rgba(0,0,0,.05)] backdrop-blur-xl"
      >
        <ToolButton
          label="选择"
          shortcut="V"
          pressed={tool === 'select'}
          onClick={() => setTool('select')}
        >
          <MousePointer2 />
        </ToolButton>
        <ToolButton
          label="平移"
          shortcut="H"
          pressed={tool === 'pan'}
          onClick={() => setTool('pan')}
        >
          <Hand />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolButton label="图片生成器" onClick={() => addNode('image')}>
          <ImageIcon />
        </ToolButton>
        <ToolButton label="视频生成器" onClick={() => addNode('video')}>
          <Video />
        </ToolButton>
        <ToolButton label="文本" onClick={() => addNode('text')}>
          <Type />
        </ToolButton>
        <ToolButton
          label="绘制分组"
          shortcut="F"
          pressed={tool === 'section'}
          onClick={() => setTool('section')}
        >
          <RectangleHorizontal />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolButton label="图层" pressed={layersOpen} onClick={onToggleLayers}>
          <Layers3 />
        </ToolButton>
        <ToolButton label="适应画布" onClick={() => fitView()}>
          <Maximize2 />
        </ToolButton>
      </div>
    </TooltipProvider>
  );
}

export function ZoomControl() {
  const { zoom, changeZoom } = useStudioCanvas();
  const percent = Math.round(zoom * 100);
  return (
    <div
      className="flex items-center rounded-lg border border-border bg-card/95 p-0.5 text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,.05)] backdrop-blur-xl"
      role="group"
      aria-label="画布缩放"
    >
      <button
        type="button"
        className="grid size-8 place-items-center rounded-md hover:bg-accent hover:text-foreground"
        aria-label="缩小"
        onClick={() => changeZoom(zoom * 0.88)}
      >
        <Minus className="size-3" />
      </button>
      <button
        type="button"
        className="min-w-12 px-1 text-center text-[11px] font-medium tabular-nums hover:text-foreground"
        aria-label="重置为 100%"
        onClick={() => changeZoom(1)}
      >
        {percent}%
      </button>
      <button
        type="button"
        className="grid size-8 place-items-center rounded-md hover:bg-accent hover:text-foreground"
        aria-label="放大"
        onClick={() => changeZoom(zoom * 1.14)}
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}

export function NodeOverlays({
  stageRef,
  selectionRect,
  leftInset = 0,
  rightInset = 0,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  selectionRect: StudioFloatingRect | null;
  leftInset?: number;
  rightInset?: number;
}) {
  const {
    nodes,
    selectedIds,
    generateNode,
    duplicateNode,
    removeNode,
    updateNodeData,
    setNodeAspect,
  } = useStudioCanvas();
  const selected =
    selectedIds.length === 1
      ? nodes.find((node) => node.id === selectedIds[0]) ?? null
      : null;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [surfaceSize, setSurfaceSize] = useState({ width: 560, height: 116 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const reduceMotion = Boolean(useReducedMotion());

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () =>
      setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [selectionRect, stageRef]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const update = () => {
      const width = surface.offsetWidth;
      const height = surface.offsetHeight;
      if (width && height) {
        setSurfaceSize({ width, height });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [selected?.id, selected?.data.status]);

  const chrome = useMemo(() => {
    if (!selectionRect || !selected || !stageSize.width || !stageSize.height) {
      return { left: 0, top: 0, visible: false };
    }
    const padding = 10;
    const minLeft = Math.max(padding, leftInset + padding);
    const maxLeft =
      stageSize.width - rightInset - surfaceSize.width - padding;
    const generator =
      selected.type !== 'section' && isGeneratorNode(selected.data);
    const preferredTop = generator
      ? selectionRect.bottom + 10
      : selectionRect.top - surfaceSize.height - 10;
    return {
      left: clamp(
        selectionRect.left +
          selectionRect.width / 2 -
          surfaceSize.width / 2,
        minLeft,
        maxLeft,
      ),
      top: clamp(
        preferredTop,
        padding,
        stageSize.height - surfaceSize.height - padding,
      ),
      visible: true,
    };
  }, [
    leftInset,
    rightInset,
    selected,
    selectionRect,
    stageSize.height,
    stageSize.width,
    surfaceSize.height,
    surfaceSize.width,
  ]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <AnimatePresence>
        {selected && selected.data.status !== 'generating' ? (
          <motion.div
            key={selected.id}
            ref={surfaceRef}
            className="pointer-events-auto absolute top-0 left-0 will-change-transform"
            style={{
              left: chrome.left,
              top: chrome.top,
              visibility: chrome.visible ? 'visible' : 'hidden',
            }}
            initial={reduceMotion ? false : { opacity: 0, y: 5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 4, scale: 0.985 }}
            transition={studioSnap}
          >
            {selected.type !== 'section' && isGeneratorNode(selected.data) ? (
              <NodeInspector
                kind={selected.type as StudioGenerativeKind}
                data={selected.data}
                canSubmit={selected.data.prompt.trim().length > 0}
                onPromptChange={(value) =>
                  updateNodeData(selected.id, { prompt: value })
                }
                onFieldChange={(key, value) =>
                  updateNodeData(selected.id, { [key]: value })
                }
                onAspectChange={(aspect) =>
                  setNodeAspect(selected.id, aspect)
                }
                onRefChange={(src) =>
                  updateNodeData(selected.id, { refSrc: src })
                }
                onSubmit={() => void generateNode(selected.id)}
              />
            ) : (
              <SelectionToolbar
                node={selected}
                onGenerate={() => void generateNode(selected.id)}
                onDuplicate={() => duplicateNode(selected.id)}
                onDelete={() => removeNode(selected.id)}
              />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SelectionToolbar({
  node,
  onGenerate,
  onDuplicate,
  onDelete,
}: {
  node: StudioNode;
  onGenerate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card/95 p-0.5 shadow-[0_4px_18px_-12px_rgba(0,0,0,.5)] backdrop-blur-xl">
      {node.type !== 'section' ? (
        <Button type="button" variant="ghost" size="xs" onClick={onGenerate}>
          <Wand2 />
          重新生成
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="复制"
        onClick={onDuplicate}
      >
        <Copy />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="删除"
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

export function LayerPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    nodes,
    selectedIds,
    selectIds,
    toggleNodeHidden,
    toggleNodeLocked,
  } = useStudioCanvas();
  const items = useMemo(
    () => [...nodes].sort((a, b) => b.zIndex - a.zIndex),
    [nodes],
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          data-moodboard-floating-occluder
          className="absolute top-3 left-3 z-20 flex max-h-[calc(100%-4.75rem)] w-60 flex-col overflow-hidden rounded-md border border-border bg-card/95 shadow-[0_4px_18px_-14px_rgba(0,0,0,.45)] backdrop-blur-xl"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={studioSnap}
        >
          <header className="flex h-9 items-center justify-between border-b border-border px-2.5">
            <span className="text-xs font-semibold">图层</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              aria-label="关闭图层"
            >
              <X />
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {items.length ? (
              items.map((node) => {
                const meta = KIND_META[node.type];
                const Icon = meta.icon;
                const selected = selectedIds.includes(node.id);
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent/70',
                      selected && 'bg-accent text-accent-foreground',
                    )}
                    onClick={() => selectIds([node.id])}
                  >
                    <Icon className="size-3.5 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 truncate">
                      {node.data.title || meta.label}
                    </span>
                    <span className="flex opacity-0 group-hover:opacity-100">
                      <span
                        role="button"
                        tabIndex={0}
                        className="grid size-6 place-items-center rounded hover:bg-card"
                        aria-label={node.data.hidden ? '显示' : '隐藏'}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleNodeHidden(node.id);
                        }}
                      >
                        {node.data.hidden ? (
                          <EyeOff className="size-3" />
                        ) : (
                          <Eye className="size-3" />
                        )}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="grid size-6 place-items-center rounded hover:bg-card"
                        aria-label={node.data.locked ? '解锁' : '锁定'}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleNodeLocked(node.id);
                        }}
                      >
                        {node.data.locked ? (
                          <Lock className="size-3" />
                        ) : (
                          <LockOpen className="size-3" />
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                画布还是空的
              </p>
            )}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
