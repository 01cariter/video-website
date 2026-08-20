'use client';

import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  Bot,
  ChevronDown,
  Copy,
  Hand,
  ImageIcon,
  Layers3,
  Lock,
  LockOpen,
  LayoutGrid,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  PencilLine,
  RectangleHorizontal,
  Trash2,
  Type,
  Video,
  Wand2,
  Upload,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import NodeInspector from './NodeInspector';
import NodePropertiesPanel from './NodePropertiesPanel';
import { useStudioCanvas } from './studio-context';
import type { StudioFloatingRect } from './useLeaferStudioRuntime';

const KIND_META: Record<
  StudioNodeKind,
  { label: string; icon: typeof ImageIcon }
> = {
  image: { label: 'Image generation', icon: ImageIcon },
  video: { label: 'Video generation', icon: Video },
  text: { label: 'Text', icon: Type },
  section: { label: 'Group', icon: RectangleHorizontal },
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
          size="icon-lg"
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            'size-10 rounded-lg [&_svg]:size-[18px]',
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
        className="flex max-w-[calc(100vw-24px)] items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card/95 p-1 shadow-[0_8px_28px_-20px_rgba(0,0,0,.55)] backdrop-blur-xl"
        role="toolbar"
        aria-label="Canvas tools"
      >
        <ToolButton
          label="Select"
          shortcut="V"
          pressed={tool === 'select'}
          onClick={() => setTool('select')}
        >
          <MousePointer2 />
        </ToolButton>
        <ToolButton
          label="Pan"
          shortcut="H"
          pressed={tool === 'pan'}
          onClick={() => setTool('pan')}
        >
          <Hand />
        </ToolButton>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden />
        <ToolButton label="Image generator" onClick={() => addNode('image')}>
          <ImageIcon />
        </ToolButton>
        <ToolButton label="Video generator" onClick={() => addNode('video')}>
          <Video />
        </ToolButton>
        <ToolButton label="Text" onClick={() => addNode('text')}>
          <Type />
        </ToolButton>
        <ToolButton
          label="Draw group"
          shortcut="F"
          pressed={tool === 'section'}
          onClick={() => setTool('section')}
        >
          <RectangleHorizontal />
        </ToolButton>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden />
        <ToolButton
          label="Layers"
          pressed={layersOpen}
          onClick={onToggleLayers}
        >
          <Layers3 />
        </ToolButton>
        <ToolButton label="Fit canvas" onClick={() => fitView()}>
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
      className="flex items-center rounded-xl border border-border bg-card/95 p-1 text-muted-foreground shadow-[0_8px_28px_-20px_rgba(0,0,0,.55)] backdrop-blur-xl"
      role="group"
      aria-label="Canvas zoom"
    >
      <button
        type="button"
        className="grid size-10 place-items-center rounded-lg hover:bg-accent hover:text-foreground"
        aria-label="Zoom out"
        onClick={() => changeZoom(zoom * 0.88)}
      >
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        className="min-w-14 px-1 text-center text-xs font-medium tabular-nums hover:text-foreground"
        aria-label="Reset zoom to 100%"
        onClick={() => changeZoom(1)}
      >
        {percent}%
      </button>
      <button
        type="button"
        className="grid size-10 place-items-center rounded-lg hover:bg-accent hover:text-foreground"
        aria-label="Zoom in"
        onClick={() => changeZoom(zoom * 1.14)}
      >
        <Plus className="size-4" />
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
    regenerateNode,
    publishNodes,
    sendNodesToAgent,
    duplicateNode,
    duplicateNodes,
    removeNode,
    removeNodes,
    arrangeNodes,
    updateNodeData,
    setNodeAspect,
    freeCreditModelsOnly,
  } = useStudioCanvas();
  const selected =
    selectedIds.length === 1
      ? (nodes.find((node) => node.id === selectedIds[0]) ?? null)
      : null;
  const selectedNodes = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((node): node is StudioNode => Boolean(node));
  }, [nodes, selectedIds]);
  const multiSelected = selectedNodes.length > 1;
  const selectionKey = selectedIds.join(':');
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [surfaceSize, setSurfaceSize] = useState({ width: 560, height: 116 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [quickEditNodeId, setQuickEditNodeId] = useState<string | null>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const hasPublishable = selectedNodes.some((node) =>
    Boolean(node.data.src || node.data.text?.trim()),
  );
  const propertiesVisible = Boolean(selected && selected.type !== 'section');

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
  }, [selected?.id, selected?.data.status, selectionKey]);

  const chrome = useMemo(() => {
    if (
      !selectionRect ||
      (!selected && !multiSelected) ||
      !stageSize.width ||
      !stageSize.height
    ) {
      return { left: 0, top: 0, visible: false };
    }
    const padding = 10;
    const minLeft = Math.max(padding, leftInset + padding);
    const maxLeft =
      stageSize.width -
      rightInset -
      (propertiesVisible ? 328 : 0) -
      surfaceSize.width -
      padding;
    const generator =
      selected && selected.type !== 'section' && isGeneratorNode(selected.data);
    const preferredTop = generator
      ? selectionRect.bottom + 10
      : selectionRect.top - surfaceSize.height - 10;
    return {
      left: clamp(
        selectionRect.left + selectionRect.width / 2 - surfaceSize.width / 2,
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
    multiSelected,
    rightInset,
    propertiesVisible,
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
        {multiSelected ||
        (selected &&
          selected.data.status !== 'generating' &&
          selected.data.status !== 'uploading') ? (
          <motion.div
            key={multiSelected ? `multi:${selectionKey}` : selected?.id}
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
            {multiSelected ? (
              <MultiSelectionToolbar
                count={selectedNodes.length}
                canPublish={hasPublishable}
                onPublish={() => publishNodes(selectedIds)}
                onSendToAgent={() => sendNodesToAgent(selectedIds)}
                onOrganize={() => arrangeNodes(selectedIds, 'tidy')}
                onArrange={(action) => arrangeNodes(selectedIds, action)}
                onDuplicate={() => duplicateNodes(selectedIds)}
                onDelete={() => removeNodes(selectedIds)}
              />
            ) : selected &&
              selected.type !== 'section' &&
              isGeneratorNode(selected.data) ? (
              <NodeInspector
                kind={selected.type as StudioGenerativeKind}
                data={selected.data}
                canSubmit={selected.data.prompt.trim().length > 0}
                freeCreditModelsOnly={freeCreditModelsOnly}
                onPromptChange={(value) =>
                  updateNodeData(selected.id, { prompt: value })
                }
                onFieldChange={(key, value) =>
                  updateNodeData(selected.id, { [key]: value })
                }
                onAspectChange={(aspect) => setNodeAspect(selected.id, aspect)}
                onRefsChange={(srcs) =>
                  updateNodeData(selected.id, {
                    refSrc: srcs[0],
                    refSrcs: srcs,
                  })
                }
                onSubmit={() => void generateNode(selected.id)}
              />
            ) : selected ? (
              <SelectionToolbar
                node={selected}
                canPublish={hasPublishable}
                onPublish={() => publishNodes([selected.id])}
                onSendToAgent={() => sendNodesToAgent([selected.id])}
                onQuickEdit={() => setQuickEditNodeId(selected.id)}
                onRegenerate={() => regenerateNode(selected.id)}
                onDuplicate={() => duplicateNode(selected.id)}
                onDelete={() => removeNode(selected.id)}
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {selected && selected.type !== 'section' ? (
        <NodePropertiesPanel
          key={selected.id}
          node={selected}
          quickEditOpen={quickEditNodeId === selected.id}
          onQuickEditOpenChange={(open) =>
            setQuickEditNodeId(open ? selected.id : null)
          }
        />
      ) : null}
    </div>
  );
}

function MultiSelectionToolbar({
  count,
  canPublish,
  onPublish,
  onSendToAgent,
  onOrganize,
  onArrange,
  onDuplicate,
  onDelete,
}: {
  count: number;
  canPublish: boolean;
  onPublish: () => void;
  onSendToAgent: () => void;
  onOrganize: () => void;
  onArrange: (
    action:
      | 'align-left'
      | 'align-center-horizontal'
      | 'align-right'
      | 'align-top'
      | 'align-center-vertical'
      | 'align-bottom'
      | 'distribute-horizontal'
      | 'distribute-vertical',
  ) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <TooltipProvider delayDuration={160}>
      <div
        data-testid="studio-multi-selection-toolbar"
        data-moodboard-floating-occluder
        className="flex max-w-[calc(100vw-20px)] items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card/95 p-1 shadow-[0_10px_34px_-22px_rgba(0,0,0,.58)] backdrop-blur-xl"
        role="toolbar"
        aria-label={`${count} selected items`}
      >
        <span className="px-2.5 text-xs font-medium text-muted-foreground tabular-nums">
          {count} selected
        </span>
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
        {canPublish ? (
          <Button
            type="button"
            size="sm"
            className="h-10 rounded-lg"
            onClick={onPublish}
          >
            <Upload /> Publish
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 rounded-lg"
          onClick={onSendToAgent}
        >
          <Bot /> Send to Agent
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 rounded-lg"
          onClick={onOrganize}
        >
          <LayoutGrid />
          Organize
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 rounded-lg"
            >
              <AlignHorizontalJustifyCenter />
              Align
              <ChevronDown className="size-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" sideOffset={8}>
            <DropdownMenuLabel>Horizontal</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onArrange('align-left')}>
                <AlignHorizontalJustifyStart /> Align left
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onArrange('align-center-horizontal')}
              >
                <AlignHorizontalJustifyCenter /> Align center
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onArrange('align-right')}>
                <AlignHorizontalJustifyEnd /> Align right
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Vertical</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onArrange('align-top')}>
                <AlignVerticalJustifyStart /> Align top
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onArrange('align-center-vertical')}
              >
                <AlignVerticalJustifyCenter /> Align middle
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onArrange('align-bottom')}>
                <AlignVerticalJustifyEnd /> Align bottom
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onArrange('distribute-horizontal')}
            >
              <AlignHorizontalSpaceBetween /> Distribute horizontally
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onArrange('distribute-vertical')}>
              <AlignVerticalSpaceBetween /> Distribute vertically
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
        <ToolButton label="Duplicate selected" onClick={onDuplicate}>
          <Copy />
        </ToolButton>
        <ToolButton label="Delete selected" onClick={onDelete}>
          <Trash2 />
        </ToolButton>
      </div>
    </TooltipProvider>
  );
}

function SelectionToolbar({
  node,
  canPublish,
  onPublish,
  onSendToAgent,
  onQuickEdit,
  onRegenerate,
  onDuplicate,
  onDelete,
}: {
  node: StudioNode;
  canPublish: boolean;
  onPublish: () => void;
  onSendToAgent: () => void;
  onQuickEdit: () => void;
  onRegenerate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-testid="studio-selection-toolbar"
      className="flex max-w-[calc(100vw-20px)] items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card/95 p-1 shadow-[0_10px_34px_-22px_rgba(0,0,0,.58)] backdrop-blur-xl"
      role="toolbar"
      aria-label="Selected item actions"
    >
      {canPublish ? (
        <Button
          type="button"
          size="sm"
          className="h-10 rounded-lg"
          onClick={onPublish}
        >
          <Upload /> Publish
        </Button>
      ) : null}
      {node.type !== 'section' ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 rounded-lg"
          onClick={onSendToAgent}
        >
          <Bot /> Send to Agent
        </Button>
      ) : null}
      {node.type !== 'section' && (node.data.src || node.data.text) ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 rounded-lg"
          onClick={onQuickEdit}
        >
          <PencilLine /> Quick Edit
        </Button>
      ) : null}
      {node.type !== 'section' && node.data.prompt.trim() ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 rounded-lg"
          onClick={onRegenerate}
        >
          <Wand2 />
          Regenerate
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="rounded-lg"
        aria-label="Duplicate"
        onClick={onDuplicate}
      >
        <Copy />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="rounded-lg"
        aria-label="Delete"
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
  const { nodes, selectedIds, selectIds, toggleNodeHidden, toggleNodeLocked } =
    useStudioCanvas();
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
            <span className="text-xs font-semibold">Layers</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              aria-label="Close layers"
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
                        aria-label={node.data.hidden ? 'Show' : 'Hide'}
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
                        aria-label={node.data.locked ? 'Unlock' : 'Lock'}
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
                The canvas is empty
              </p>
            )}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
