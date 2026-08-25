'use client';

import '@leafer-in/resize';
import { ScrollBar } from '@leafer-in/scroll';
import {
  DragEvent,
  EditorEvent,
  EditorMoveEvent,
  EditorScaleEvent,
  PointerEvent,
  PropertyEvent,
  ZoomEvent,
  type App,
  type IUI,
} from 'leafer-editor';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  containedNodeIdsForSection,
  resolveStudioResizeDirection,
  resolveStudioResizeSnap,
  resolveStudioSnap,
  topStudioContentNodeAtPoint,
  type StudioBounds,
  type StudioSnapGuide,
} from '@/lib/studio/geometry';
import type { StudioNode, StudioViewport } from '@/lib/studio/types';
import type {
  StudioReferencePickerState,
  StudioTool,
} from './studio-context';

export interface StudioFloatingRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type StudioCanvasSnapGuide = StudioSnapGuide;

export type StudioCanvasMenuState =
  | {
      type: 'pane';
      x: number;
      y: number;
      canvas: { x: number; y: number };
    }
  | { type: 'node'; x: number; y: number; nodeId: string }
  | { type: 'selection'; x: number; y: number; ids: string[] };

interface UseLeaferStudioRuntimeOptions {
  nodes: StudioNode[];
  selectedIds: string[];
  tool: StudioTool;
  initialViewport: StudioViewport;
  onSelectIds: (ids: string[]) => void;
  onNodesChange: (nodes: StudioNode[]) => void;
  onViewportChange: (viewport: StudioViewport) => void;
  onBlankDoubleClick: (point: { x: number; y: number }) => void;
  onNodeDoubleClick: (id: string) => void;
  referencePicker: StudioReferencePickerState | null;
  onReferencePick: (id: string) => void;
  onReferencePickCancel: () => void;
  onSectionDraw: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  onContextMenu: (menu: StudioCanvasMenuState | null) => void;
  viewportInsets?: {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  };
}

function nodeIdFromTarget(target: unknown): string | null {
  const first = Array.isArray(target) ? target[0] : target;
  let current = first as
    | { data?: { nodeId?: unknown }; parent?: unknown }
    | null
    | undefined;
  const seen = new Set<unknown>();
  while (current) {
    if (seen.has(current)) return null;
    seen.add(current);
    if (typeof current.data?.nodeId === 'string') return current.data.nodeId;
    current = current.parent as typeof current;
  }
  return null;
}

function nodeIdsFromTarget(target: unknown) {
  const targets = Array.isArray(target) ? target : [target];
  return targets
    .map(nodeIdFromTarget)
    .filter(
      (id, index, ids): id is string =>
        Boolean(id) && ids.indexOf(id) === index,
    );
}

function selectAppNodes(app: App | null, ids: string[]) {
  const editor = app?.editor as
    | { target?: IUI | IUI[]; select?: (targets: IUI[]) => void }
    | undefined;
  if (!editor) return 0;
  const targets = ids
    .map((id) => app?.findId(id))
    .filter((target): target is IUI => Boolean(target));
  if (ids.length && targets.length !== ids.length) return targets.length;
  editor.select?.(targets);
  editor.target =
    targets.length === 1 ? targets[0] : targets.length > 1 ? targets : undefined;
  return targets.length;
}

function eventCanvasPoint(event: {
  getPagePoint?: () => { x?: number; y?: number };
}) {
  const point = event.getPagePoint?.();
  return {
    x: Math.round(Number(point?.x ?? 0)),
    y: Math.round(Number(point?.y ?? 0)),
  };
}

function canvasEventNodeId(event: unknown, nodes: readonly StudioNode[]) {
  const targetId = nodeIdFromTarget(
    (event as { target?: unknown } | undefined)?.target,
  );
  const target = targetId
    ? nodes.find((node) => node.id === targetId)
    : undefined;
  if (target && target.type !== 'section') return targetId;
  const content = topStudioContentNodeAtPoint(
    nodes,
    eventCanvasPoint(event as never),
  );
  return content?.id ?? targetId;
}

function eventClientPoint(
  event: Record<string, unknown>,
  host: HTMLElement | null,
  app: App | null,
) {
  const source = (event.origin ||
    event.nativeEvent ||
    event.event ||
    event) as Record<string, unknown>;
  const clientX = Number(source.clientX);
  const clientY = Number(source.clientY);
  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    return { x: clientX, y: clientY };
  }
  const point = eventCanvasPoint(event);
  const rect = host?.getBoundingClientRect();
  const tree = app?.tree as
    | { x?: number; y?: number; scaleX?: number; scaleY?: number; scale?: number }
    | undefined;
  const scaleX = Number(tree?.scaleX ?? tree?.scale ?? 1) || 1;
  const scaleY = Number(tree?.scaleY ?? tree?.scale ?? 1) || 1;
  return {
    x: Number(rect?.left ?? 0) + Number(tree?.x ?? 0) + point.x * scaleX,
    y: Number(rect?.top ?? 0) + Number(tree?.y ?? 0) + point.y * scaleY,
  };
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function boundsForNodes(nodes: StudioNode[]) {
  if (!nodes.length) return null;
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function frameBounds(frame: IUI): StudioBounds {
  const left = Number(frame.x ?? 0);
  const top = Number(frame.y ?? 0);
  const width = Math.max(1, Number(frame.width ?? 1));
  const height = Math.max(1, Number(frame.height ?? 1));
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function boundsForFrames(frames: IUI[]): StudioBounds | null {
  if (!frames.length) return null;
  const bounds = frames.map(frameBounds);
  const left = Math.min(...bounds.map((item) => item.left));
  const top = Math.min(...bounds.map((item) => item.top));
  const right = Math.max(...bounds.map((item) => item.right));
  const bottom = Math.max(...bounds.map((item) => item.bottom));
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function setFramePosition(frame: IUI, x: number, y: number) {
  const target = frame as IUI & {
    set?: (value: { x: number; y: number }) => void;
    forceUpdate?: () => void;
  };
  if (target.set) {
    target.set({ x, y });
  } else {
    Reflect.set(target, 'x', x);
    Reflect.set(target, 'y', y);
  }
  target.forceUpdate?.();
}

function setFrameBounds(frame: IUI, bounds: StudioBounds) {
  const target = frame as IUI & {
    set?: (value: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => void;
    forceUpdate?: () => void;
  };
  const value = {
    x: bounds.left,
    y: bounds.top,
    width: bounds.width,
    height: bounds.height,
  };
  if (target.set) target.set(value);
  else Object.assign(target, value);
  target.forceUpdate?.();
}

function ratioResizeBounds(
  current: StudioBounds,
  snapped: StudioBounds,
  direction: number,
  ratio: number,
  axis: 'x' | 'y',
): StudioBounds {
  const movesLeft = direction === 0 || direction === 6 || direction === 7;
  const movesRight = direction === 2 || direction === 3 || direction === 4;
  const movesTop = direction === 0 || direction === 1 || direction === 2;
  const movesBottom = direction === 4 || direction === 5 || direction === 6;
  const width = axis === 'x' ? snapped.width : snapped.height * ratio;
  const height = axis === 'y' ? snapped.height : snapped.width / ratio;
  const centerX = current.left + current.width / 2;
  const centerY = current.top + current.height / 2;
  const left = movesLeft
    ? current.right - width
    : movesRight
      ? current.left
      : centerX - width / 2;
  const top = movesTop
    ? current.bottom - height
    : movesBottom
      ? current.top
      : centerY - height / 2;
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function setTreeViewport(
  tree: {
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    forceUpdate?: () => void;
  },
  viewport: StudioViewport,
) {
  Reflect.set(tree, 'x', viewport.x);
  Reflect.set(tree, 'y', viewport.y);
  Reflect.set(tree, 'scaleX', viewport.zoom);
  Reflect.set(tree, 'scaleY', viewport.zoom);
  tree.forceUpdate?.();
}

export function useLeaferStudioRuntime({
  nodes,
  selectedIds,
  tool,
  initialViewport,
  onSelectIds,
  onNodesChange,
  onViewportChange,
  onBlankDoubleClick,
  onNodeDoubleClick,
  referencePicker,
  onReferencePick,
  onReferencePickCancel,
  onSectionDraw,
  onContextMenu,
  viewportInsets,
}: UseLeaferStudioRuntimeOptions) {
  const insetLeft = Math.max(0, Number(viewportInsets?.left ?? 0));
  const insetRight = Math.max(0, Number(viewportInsets?.right ?? 0));
  const insetTop = Math.max(0, Number(viewportInsets?.top ?? 0));
  const insetBottom = Math.max(0, Number(viewportInsets?.bottom ?? 0));
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<App | null>(null);
  const layerRef = useRef<IUI | null>(null);
  const scrollBarRef = useRef<ScrollBar | null>(null);
  const nodesRef = useRef(nodes);
  const selectedIdsRef = useRef(selectedIds);
  const toolRef = useRef(tool);
  const callbacksRef = useRef({
    onSelectIds,
    onNodesChange,
    onViewportChange,
    onBlankDoubleClick,
    onNodeDoubleClick,
    referencePicker,
    onReferencePick,
    onReferencePickCancel,
    onSectionDraw,
    onContextMenu,
  });
  const sectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const sectionHandledRef = useRef(false);
  const selectionGestureRef = useRef<{
    ids: string[];
    additive: boolean;
    targetId?: string;
  } | null>(null);
  const resizeDirectionRef = useRef<number | null>(null);
  const sectionChildrenDragRef = useRef<{
    sectionId: string;
    childIds: string[];
    lastX: number;
    lastY: number;
  } | null>(null);
  const snapGuardRef = useRef(false);
  const snapGuideKeyRef = useRef('');
  const frameRef = useRef<number | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [zoom, setZoom] = useState(initialViewport.zoom);
  const [selectionRect, setSelectionRect] =
    useState<StudioFloatingRect | null>(null);
  const revealedSelectionKeyRef = useRef('');
  const [sectionDraftRect, setSectionDraftRect] =
    useState<StudioFloatingRect | null>(null);
  const [snapGuides, setSnapGuides] = useState<StudioCanvasSnapGuide[]>([]);

  useEffect(() => {
    nodesRef.current = nodes;
    selectedIdsRef.current = selectedIds;
    toolRef.current = tool;
    callbacksRef.current = {
      onSelectIds,
      onNodesChange,
      onViewportChange,
      onBlankDoubleClick,
      onNodeDoubleClick,
      referencePicker,
      onReferencePick,
      onReferencePickCancel,
      onSectionDraw,
      onContextMenu,
    };
  }, [
    nodes,
    onBlankDoubleClick,
    onNodeDoubleClick,
    onContextMenu,
    onNodesChange,
    onReferencePick,
    onReferencePickCancel,
    onSectionDraw,
    onSelectIds,
    onViewportChange,
    referencePicker,
    selectedIds,
    tool,
  ]);

  const findFrame = useCallback((id: string): IUI | null => {
    const app = appRef.current as
      | (App & {
          findId?: (value: string) => IUI | null;
          tree?: IUI & { findOne?: (selector: string) => IUI | null };
          editor?: { target?: unknown };
        })
      | null;
    const layer = layerRef.current as
      | (IUI & { findOne?: (selector: string) => IUI | null })
      | null;
    const found =
      app?.findId?.(id) ??
      app?.tree?.findOne?.(`#${id}`) ??
      layer?.findOne?.(`#${id}`);
    if (found) return found;

    const targets = Array.isArray(app?.editor?.target)
      ? app.editor.target
      : [app?.editor?.target];
    for (const target of targets) {
      let current = target as
        | (IUI & { data?: { nodeId?: unknown }; parent?: unknown })
        | null
        | undefined;
      const seen = new Set<unknown>();
      while (current && !seen.has(current)) {
        seen.add(current);
        if (current.id === id || current.data?.nodeId === id) return current;
        current = current.parent as typeof current;
      }
    }
    return null;
  }, []);

  const currentViewport = useCallback((): StudioViewport => {
    const tree = appRef.current?.tree as
      | {
          x?: number;
          y?: number;
          scaleX?: number;
          scaleY?: number;
          scale?: number;
        }
      | undefined;
    return {
      x: Math.round(Number(tree?.x ?? 0)),
      y: Math.round(Number(tree?.y ?? 0)),
      zoom: Number(tree?.scaleX ?? tree?.scale ?? 1) || 1,
    };
  }, []);

  const updateSelectionRect = useCallback(() => {
    const host = hostRef.current;
    const app = appRef.current;
    if (!host || !app || !selectedIdsRef.current.length) {
      setSelectionRect(null);
      return;
    }
    const frames = selectedIdsRef.current
      .map(findFrame)
      .filter((frame): frame is IUI => Boolean(frame));
    if (!frames.length) {
      setSelectionRect(null);
      return;
    }
    const tree = app.tree as unknown as {
      x?: number;
      y?: number;
      scaleX?: number;
      scaleY?: number;
      scale?: number;
    };
    const scaleX = Number(tree.scaleX ?? tree.scale ?? 1) || 1;
    const scaleY = Number(tree.scaleY ?? tree.scale ?? 1) || 1;
    const treeX = Number(tree.x ?? 0);
    const treeY = Number(tree.y ?? 0);
    const boxes = frames.map((frame) => {
      const x = Number(frame.x ?? 0);
      const y = Number(frame.y ?? 0);
      const width = Math.max(1, Number(frame.width ?? 1));
      const height = Math.max(1, Number(frame.height ?? 1));
      return {
        left: treeX + x * scaleX,
        top: treeY + y * scaleY,
        right: treeX + (x + width) * scaleX,
        bottom: treeY + (y + height) * scaleY,
      };
    });
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    setSelectionRect({
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    });
  }, [findFrame]);

  const scheduleSelectionRect = useCallback(() => {
    if (frameRef.current != null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updateSelectionRect();
    });
  }, [updateSelectionRect]);

  const clearSnapGuides = useCallback(() => {
    if (!snapGuideKeyRef.current) return;
    snapGuideKeyRef.current = '';
    setSnapGuides([]);
  }, []);

  const publishSnapGuides = useCallback(
    (guides: StudioSnapGuide[]) => {
      if (!guides.length) {
        clearSnapGuides();
        return;
      }
      const viewport = currentViewport();
      const next = guides.map((guide) => {
        const axisOffset = guide.axis === 'x' ? viewport.x : viewport.y;
        const crossOffset = guide.axis === 'x' ? viewport.y : viewport.x;
        return {
          ...guide,
          position: axisOffset + guide.position * viewport.zoom,
          start: crossOffset + guide.start * viewport.zoom,
          end: crossOffset + guide.end * viewport.zoom,
        };
      });
      const key = next
        .map(
          (guide) =>
            `${guide.axis}:${guide.position.toFixed(2)}:${guide.start.toFixed(2)}:${guide.end.toFixed(2)}`,
        )
        .join('|');
      if (key === snapGuideKeyRef.current) return;
      snapGuideKeyRef.current = key;
      setSnapGuides(next);
    },
    [clearSnapGuides, currentViewport],
  );

  const beginSectionChildrenDrag = useCallback(
    (event: unknown) => {
      const targetId = nodeIdFromTarget(
        (event as { target?: unknown } | undefined)?.target,
      );
      const selected = selectedIdsRef.current;
      const candidateIds =
        selected.length === 1 ? selected : targetId ? [targetId] : [];
      const sectionId = candidateIds.find(
        (id) =>
          nodesRef.current.find((node) => node.id === id)?.type === 'section',
      );
      if (!sectionId) {
        sectionChildrenDragRef.current = null;
        return;
      }
      const frame = findFrame(sectionId);
      if (!frame) {
        sectionChildrenDragRef.current = null;
        return;
      }
      sectionChildrenDragRef.current = {
        sectionId,
        childIds: containedNodeIdsForSection(
          nodesRef.current,
          sectionId,
        ).filter((id) => !selected.includes(id)),
        lastX: Number(frame.x ?? 0),
        lastY: Number(frame.y ?? 0),
      };
    },
    [findFrame],
  );

  const syncSectionChildrenDuringDrag = useCallback(() => {
    const state = sectionChildrenDragRef.current;
    if (!state?.childIds.length) return;
    const sectionFrame = findFrame(state.sectionId);
    if (!sectionFrame) return;
    const nextX = Number(sectionFrame.x ?? state.lastX);
    const nextY = Number(sectionFrame.y ?? state.lastY);
    const deltaX = nextX - state.lastX;
    const deltaY = nextY - state.lastY;
    if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) return;

    for (const id of state.childIds) {
      const frame = findFrame(id);
      if (!frame) continue;
      setFramePosition(
        frame,
        Number(frame.x ?? 0) + deltaX,
        Number(frame.y ?? 0) + deltaY,
      );
    }
    state.lastX = nextX;
    state.lastY = nextY;
    appRef.current?.tree?.forceUpdate?.();
  }, [findFrame]);

  const applyMoveSnapping = useCallback(() => {
    if (toolRef.current !== 'select' || snapGuardRef.current) return;
    const selected = new Set(selectedIdsRef.current);
    const movingFrames = [...selected]
      .map(findFrame)
      .filter((frame): frame is IUI => Boolean(frame));
    const movingBounds = boundsForFrames(movingFrames);
    if (!movingBounds) {
      clearSnapGuides();
      return;
    }

    const groupedChildren = new Set(
      sectionChildrenDragRef.current?.childIds ?? [],
    );
    const targetBounds = nodesRef.current
      .filter(
        (node) =>
          !selected.has(node.id) &&
          !groupedChildren.has(node.id) &&
          node.data.hidden !== true,
      )
      .map((node) => findFrame(node.id))
      .filter((frame): frame is IUI => Boolean(frame))
      .map(frameBounds);
    if (!targetBounds.length) {
      clearSnapGuides();
      return;
    }

    const viewport = currentViewport();
    const snap = resolveStudioSnap(
      movingBounds,
      targetBounds,
      6 / Math.max(0.1, viewport.zoom),
    );
    if (snap.deltaX || snap.deltaY) {
      snapGuardRef.current = true;
      try {
        for (const frame of movingFrames) {
          setFramePosition(
            frame,
            Number(frame.x ?? 0) + snap.deltaX,
            Number(frame.y ?? 0) + snap.deltaY,
          );
        }
        appRef.current?.tree?.forceUpdate?.();
      } finally {
        snapGuardRef.current = false;
      }
    }
    publishSnapGuides(snap.guides);
  }, [
    clearSnapGuides,
    currentViewport,
    findFrame,
    publishSnapGuides,
  ]);

  const applyResizeSnapping = useCallback(
    (event?: unknown) => {
      if (
        toolRef.current !== 'select' ||
        snapGuardRef.current ||
        selectedIdsRef.current.length !== 1
      ) {
        return;
      }
      const source = event as
        | {
            direction?: unknown;
            current?: { direction?: unknown };
            target?: { direction?: unknown };
          }
        | undefined;
      const direction = resolveStudioResizeDirection(
        source?.direction,
        source?.current?.direction,
        source?.target?.direction,
        resizeDirectionRef.current,
      );
      if (direction == null) {
        clearSnapGuides();
        return;
      }
      const nodeId = selectedIdsRef.current[0];
      const node = nodesRef.current.find((item) => item.id === nodeId);
      const frame = findFrame(nodeId);
      if (!node || !frame) return;
      const movingBounds = frameBounds(frame);
      const targetBounds = nodesRef.current
        .filter(
          (item) =>
            item.id !== nodeId &&
            item.data.hidden !== true,
        )
        .map((item) => findFrame(item.id))
        .filter((item): item is IUI => Boolean(item))
        .map(frameBounds);
      if (!targetBounds.length) {
        clearSnapGuides();
        return;
      }

      const viewport = currentViewport();
      const snap = resolveStudioResizeSnap(
        movingBounds,
        targetBounds,
        direction,
        6 / Math.max(0.1, viewport.zoom),
      );
      if (!snap.snappedX && !snap.snappedY) {
        clearSnapGuides();
        return;
      }

      let nextBounds = snap.bounds;
      let guides = snap.guides;
      const minimumSize =
        node.type === 'image' || node.type === 'video' ? 1 : 40;
      if (node.type === 'image' || node.type === 'video') {
        const horizontalOnly = direction === 3 || direction === 7;
        const verticalOnly = direction === 1 || direction === 5;
        const axis =
          horizontalOnly || !snap.snappedY
            ? 'x'
            : verticalOnly || !snap.snappedX
              ? 'y'
              : Math.abs(snap.deltaX) <= Math.abs(snap.deltaY)
                ? 'x'
                : 'y';
        const ratio =
          node.width > 0 && node.height > 0
            ? node.width / node.height
            : movingBounds.width / movingBounds.height;
        nextBounds = ratioResizeBounds(
          movingBounds,
          snap.bounds,
          direction,
          ratio,
          axis,
        );
        guides = snap.guides.filter((guide) => guide.axis === axis);
      }
      if (
        nextBounds.width < minimumSize ||
        nextBounds.height < minimumSize
      ) {
        clearSnapGuides();
        return;
      }

      snapGuardRef.current = true;
      try {
        setFrameBounds(frame, nextBounds);
        appRef.current?.tree?.forceUpdate?.();
      } finally {
        snapGuardRef.current = false;
      }
      publishSnapGuides(guides);
    },
    [
      clearSnapGuides,
      currentViewport,
      findFrame,
      publishSnapGuides,
    ],
  );

  const readNodesFromFrames = useCallback(
    () => {
      let changed = false;
      const current = nodesRef.current;
      const next = current.map((node) => {
        const frame = findFrame(node.id);
        if (!frame) return node;
        const minimumSize =
          node.type === 'image' || node.type === 'video' ? 1 : 40;
        const x = Math.round(Number(frame.x ?? node.x));
        const y = Math.round(Number(frame.y ?? node.y));
        const width = Math.max(
          minimumSize,
          Math.round(Number(frame.width ?? node.width)),
        );
        const height = Math.max(
          minimumSize,
          Math.round(Number(frame.height ?? node.height)),
        );
        const zIndex = Math.round(Number(frame.zIndex ?? node.zIndex));
        if (
          x === node.x &&
          y === node.y &&
          width === node.width &&
          height === node.height &&
          node.rotation === 0 &&
          zIndex === node.zIndex
        ) {
          return node;
        }
        changed = true;
        return {
          ...node,
          x,
          y,
          width,
          height,
          rotation: 0,
          zIndex,
        };
      });
      return changed ? next : current;
    },
    [findFrame],
  );

  const commitFrameState = useCallback(() => {
    callbacksRef.current.onNodesChange(readNodesFromFrames());
  }, [readNodesFromFrames]);

  const handleAppReady = useCallback(
    (app: App) => {
      appRef.current = app;
      const tree = app.tree as unknown as {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        forceUpdate?: () => void;
      };
      setTreeViewport(tree, {
        x: initialViewport.x,
        y: initialViewport.y,
        zoom: initialViewport.zoom,
      });
      try {
        scrollBarRef.current = new ScrollBar(app as never, {
          theme: {
            fill: 'rgba(35,35,32,0.28)',
            stroke: 'rgba(255,255,255,0.72)',
          },
          padding: 1,
          minSize: 18,
        });
      } catch {
        scrollBarRef.current = null;
      }
    },
    [initialViewport.x, initialViewport.y, initialViewport.zoom],
  );

  const handleLayerCreated = useCallback(
    (layer: IUI) => {
      layerRef.current = layer;
      setRuntimeReady(true);
      selectAppNodes(appRef.current, selectedIdsRef.current);
      scheduleSelectionRect();
    },
    [scheduleSelectionRect],
  );

  useLayoutEffect(() => {
    return () => {
      scrollBarRef.current?.destroy();
      scrollBarRef.current = null;
      appRef.current = null;
      layerRef.current = null;
      resizeDirectionRef.current = null;
      sectionChildrenDragRef.current = null;
      snapGuideKeyRef.current = '';
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const app = appRef.current as (App & {
      config?: { move?: Record<string, unknown> };
      editor?: {
        config?: Record<string, unknown>;
        target?: unknown;
        on: (event: string, listener: (event?: unknown) => void) => void;
        off: (event: string, listener: (event?: unknown) => void) => void;
      };
    }) | null;
    const editor = app?.editor;
    if (!runtimeReady || !app || !editor) return;
    const host = hostRef.current;

    const onNativePointerDown = (event: globalThis.PointerEvent) => {
      if (callbacksRef.current.referencePicker) {
        selectionGestureRef.current = null;
        return;
      }
      selectionGestureRef.current = {
        ids: [...selectedIdsRef.current],
        additive: event.metaKey || event.ctrlKey || event.shiftKey,
      };
    };

    const syncSelection = () => {
      const picker = callbacksRef.current.referencePicker;
      if (picker) {
        const ids = [picker.targetId];
        if (!sameIds(ids, nodeIdsFromTarget(editor.target))) {
          selectAppNodes(appRef.current, ids);
        }
        if (!sameIds(ids, selectedIdsRef.current)) {
          selectedIdsRef.current = ids;
          callbacksRef.current.onSelectIds(ids);
        }
        clearSnapGuides();
        scheduleSelectionRect();
        return;
      }
      const ids = nodeIdsFromTarget(editor.target);
      if (!sameIds(ids, selectedIdsRef.current)) {
        selectedIdsRef.current = ids;
        callbacksRef.current.onSelectIds(ids);
      }
      clearSnapGuides();
      scheduleSelectionRect();
    };
    const beginTransform = () => {
      scheduleSelectionRect();
    };
    const onDragStart = (event: unknown) => {
      clearSnapGuides();
      const source = event as {
        direction?: unknown;
        current?: { direction?: unknown };
        target?: { direction?: unknown };
      };
      resizeDirectionRef.current = resolveStudioResizeDirection(
        source.direction,
        source.current?.direction,
        source.target?.direction,
      );
      beginSectionChildrenDrag(event);
      beginTransform();
    };
    const syncEditorMoveGeometry = () => {
      applyMoveSnapping();
      syncSectionChildrenDuringDrag();
      scheduleSelectionRect();
    };
    const syncEditorScaleGeometry = (event?: unknown) => {
      applyResizeSnapping(event);
      syncSectionChildrenDuringDrag();
      scheduleSelectionRect();
    };
    const endNodeTransform = () => {
      syncSectionChildrenDuringDrag();
      sectionChildrenDragRef.current = null;
      clearSnapGuides();
      commitFrameState();
      scheduleSelectionRect();
    };
    const syncViewport = () => {
      const viewport = currentViewport();
      setZoom(viewport.zoom);
      callbacksRef.current.onViewportChange(viewport);
      clearSnapGuides();
      scheduleSelectionRect();
    };
    const onPointerUp = () => {
      resizeDirectionRef.current = null;
      clearSnapGuides();
    };
    const onPointerDown = (event: unknown) => {
      const targetId = canvasEventNodeId(event, nodesRef.current);
      const picker = callbacksRef.current.referencePicker;
      if (picker) {
        if (targetId && picker.allowedIds.includes(targetId)) {
          callbacksRef.current.onReferencePick(targetId);
        } else if (!targetId) {
          callbacksRef.current.onReferencePickCancel();
        }
        selectAppNodes(appRef.current, [picker.targetId]);
        selectedIdsRef.current = [picker.targetId];
        callbacksRef.current.onSelectIds([picker.targetId]);
        scheduleSelectionRect();
        return;
      }
      if (toolRef.current === 'section' && !targetId) {
        sectionStartRef.current = eventCanvasPoint(event as never);
        selectAppNodes(appRef.current, []);
        selectedIdsRef.current = [];
        callbacksRef.current.onSelectIds([]);
        return;
      }
      if (toolRef.current === 'select' && targetId) {
        if (selectionGestureRef.current) {
          selectionGestureRef.current.targetId = targetId;
        }
        const source = event as {
          metaKey?: boolean;
          ctrlKey?: boolean;
          shiftKey?: boolean;
          origin?: {
            metaKey?: boolean;
            ctrlKey?: boolean;
            shiftKey?: boolean;
          };
          nativeEvent?: {
            metaKey?: boolean;
            ctrlKey?: boolean;
            shiftKey?: boolean;
          };
        };
        const gesture = selectionGestureRef.current;
        const additive =
          gesture?.additive ??
          Boolean(
            source.metaKey ||
              source.ctrlKey ||
              source.shiftKey ||
              source.origin?.metaKey ||
              source.origin?.ctrlKey ||
              source.origin?.shiftKey ||
              source.nativeEvent?.metaKey ||
              source.nativeEvent?.ctrlKey ||
              source.nativeEvent?.shiftKey,
          );
        const current = gesture?.ids ?? selectedIdsRef.current;
        const next = additive
          ? current.includes(targetId)
            ? current.filter((id) => id !== targetId)
            : current.concat(targetId)
          : [targetId];
        selectAppNodes(appRef.current, next);
        selectedIdsRef.current = next;
        callbacksRef.current.onSelectIds(next);
        scheduleSelectionRect();
      }
    };
    const onDrag = (event: unknown) => {
      if (toolRef.current === 'section' && sectionStartRef.current) {
        const current = eventCanvasPoint(event as never);
        const start = sectionStartRef.current;
        const x = Math.min(start.x, current.x);
        const y = Math.min(start.y, current.y);
        const width = Math.abs(current.x - start.x);
        const height = Math.abs(current.y - start.y);
        const viewport = currentViewport();
        setSectionDraftRect({
          left: viewport.x + x * viewport.zoom,
          top: viewport.y + y * viewport.zoom,
          right: viewport.x + (x + width) * viewport.zoom,
          bottom: viewport.y + (y + height) * viewport.zoom,
          width: width * viewport.zoom,
          height: height * viewport.zoom,
        });
        return;
      }
      beginTransform();
      scheduleSelectionRect();
    };
    const onDragEnd = (event: unknown) => {
      resizeDirectionRef.current = null;
      if (toolRef.current === 'section' && sectionStartRef.current) {
        const current = eventCanvasPoint(event as never);
        const start = sectionStartRef.current;
        const rect = {
          x: Math.min(start.x, current.x),
          y: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        };
        sectionStartRef.current = null;
        setSectionDraftRect(null);
        if (rect.width >= 64 && rect.height >= 64) {
          sectionHandledRef.current = true;
          callbacksRef.current.onSectionDraw(rect);
        }
        return;
      }
      endNodeTransform();
    };
    const onDoubleTap = (event: unknown) => {
      if (callbacksRef.current.referencePicker) return;
      const nodeId = canvasEventNodeId(event, nodesRef.current);
      if (nodeId) {
        selectAppNodes(appRef.current, [nodeId]);
        selectedIdsRef.current = [nodeId];
        callbacksRef.current.onSelectIds([nodeId]);
        callbacksRef.current.onContextMenu(null);
        callbacksRef.current.onNodeDoubleClick(nodeId);
        scheduleSelectionRect();
        return;
      }
      callbacksRef.current.onBlankDoubleClick(eventCanvasPoint(event as never));
    };
    const onTap = (event: unknown) => {
      if (callbacksRef.current.referencePicker) {
        selectionGestureRef.current = null;
        return;
      }
      const targetId = canvasEventNodeId(event, nodesRef.current);
      const startedOnNode = Boolean(selectionGestureRef.current?.targetId);
      selectionGestureRef.current = null;
      if (sectionHandledRef.current) {
        sectionHandledRef.current = false;
        return;
      }
      if (!targetId && !startedOnNode) {
        callbacksRef.current.onContextMenu(null);
        if (toolRef.current === 'select') {
          selectAppNodes(appRef.current, []);
          selectedIdsRef.current = [];
          callbacksRef.current.onSelectIds([]);
          scheduleSelectionRect();
        }
      }
    };
    const onMenu = (event: unknown) => {
      (event as { preventDefault?: () => void }).preventDefault?.();
      if (callbacksRef.current.referencePicker) return;
      const targetId =
        canvasEventNodeId(event, nodesRef.current) ||
        nodeIdFromTarget(editor.target);
      const client = eventClientPoint(
        event as Record<string, unknown>,
        hostRef.current,
        appRef.current,
      );
      if (targetId) {
        const ids = selectedIdsRef.current.includes(targetId)
          ? selectedIdsRef.current
          : [targetId];
        selectAppNodes(appRef.current, ids);
        selectedIdsRef.current = ids;
        callbacksRef.current.onSelectIds(ids);
        callbacksRef.current.onContextMenu(
          ids.length > 1
            ? { type: 'selection', x: client.x, y: client.y, ids }
            : { type: 'node', x: client.x, y: client.y, nodeId: targetId },
        );
      } else {
        callbacksRef.current.onContextMenu({
          type: 'pane',
          x: client.x,
          y: client.y,
          canvas: eventCanvasPoint(event as never),
        });
      }
    };

    host?.addEventListener('pointerdown', onNativePointerDown, true);
    app.on(PointerEvent.DOWN, onPointerDown);
    app.on(PointerEvent.TAP, onTap);
    app.on(PointerEvent.DOUBLE_TAP, onDoubleTap);
    app.on(PointerEvent.MENU, onMenu);
    app.on(PointerEvent.UP, onPointerUp);
    app.on(DragEvent.START, onDragStart);
    app.on(DragEvent.DRAG, onDrag);
    app.on(DragEvent.END, onDragEnd);
    app.on(ZoomEvent.START, beginTransform);
    app.on(ZoomEvent.ZOOM, beginTransform);
    app.on(ZoomEvent.END, syncViewport);
    app.tree.on(PropertyEvent.LEAFER_CHANGE, scheduleSelectionRect);
    app.tree.on('move', beginTransform);
    app.tree.on('move.end', syncViewport);
    editor.on(EditorEvent.SELECT, syncSelection);
    editor.on(EditorMoveEvent.MOVE, syncEditorMoveGeometry);
    editor.on(EditorScaleEvent.SCALE, syncEditorScaleGeometry);

    return () => {
      host?.removeEventListener('pointerdown', onNativePointerDown, true);
      app.off(PointerEvent.DOWN, onPointerDown);
      app.off(PointerEvent.TAP, onTap);
      app.off(PointerEvent.DOUBLE_TAP, onDoubleTap);
      app.off(PointerEvent.MENU, onMenu);
      app.off(PointerEvent.UP, onPointerUp);
      app.off(DragEvent.START, onDragStart);
      app.off(DragEvent.DRAG, onDrag);
      app.off(DragEvent.END, onDragEnd);
      app.off(ZoomEvent.START, beginTransform);
      app.off(ZoomEvent.ZOOM, beginTransform);
      app.off(ZoomEvent.END, syncViewport);
      app.tree.off(PropertyEvent.LEAFER_CHANGE, scheduleSelectionRect);
      app.tree.off('move', beginTransform);
      app.tree.off('move.end', syncViewport);
      editor.off(EditorEvent.SELECT, syncSelection);
      editor.off(EditorMoveEvent.MOVE, syncEditorMoveGeometry);
      editor.off(EditorScaleEvent.SCALE, syncEditorScaleGeometry);
    };
  }, [
    applyMoveSnapping,
    applyResizeSnapping,
    beginSectionChildrenDrag,
    clearSnapGuides,
    commitFrameState,
    currentViewport,
    runtimeReady,
    scheduleSelectionRect,
    syncSectionChildrenDuringDrag,
  ]);

  useEffect(() => {
    let frame = 0;
    let attempts = 0;
    const syncSelection = () => {
      const selectedCount = selectAppNodes(appRef.current, selectedIds);
      scheduleSelectionRect();
      attempts += 1;
      if (selectedCount < selectedIds.length && attempts < 12) {
        frame = window.requestAnimationFrame(syncSelection);
      }
    };
    syncSelection();
    return () => window.cancelAnimationFrame(frame);
  }, [scheduleSelectionRect, selectedIds]);

  useEffect(() => {
    const host = hostRef.current;
    const tree = appRef.current?.tree as unknown as
      | {
          x?: number;
          y?: number;
          forceUpdate?: () => void;
        }
      | undefined;
    if (!host || !tree || !selectionRect || !selectedIds.length) {
      if (!selectedIds.length) revealedSelectionKeyRef.current = '';
      return;
    }
    const key = `${selectedIds.join(':')}:${insetLeft}:${insetRight}:${insetTop}:${insetBottom}:${host.clientWidth}:${host.clientHeight}`;
    if (revealedSelectionKeyRef.current === key) return;
    revealedSelectionKeyRef.current = key;

    const margin = 18;
    const safeLeft = insetLeft + margin;
    const safeRight = host.clientWidth - insetRight - margin;
    const safeTop = insetTop + margin;
    const safeBottom = host.clientHeight - insetBottom - margin;
    let deltaX = 0;
    let deltaY = 0;
    if (selectionRect.width <= safeRight - safeLeft) {
      if (selectionRect.right > safeRight) {
        deltaX = safeRight - selectionRect.right;
      } else if (selectionRect.left < safeLeft) {
        deltaX = safeLeft - selectionRect.left;
      }
    }
    if (selectionRect.height <= safeBottom - safeTop) {
      if (selectionRect.bottom > safeBottom) {
        deltaY = safeBottom - selectionRect.bottom;
      } else if (selectionRect.top < safeTop) {
        deltaY = safeTop - selectionRect.top;
      }
    }
    if (!deltaX && !deltaY) return;
    const viewport = currentViewport();
    setTreeViewport(tree, {
      x: viewport.x + deltaX,
      y: viewport.y + deltaY,
      zoom: viewport.zoom,
    });
    callbacksRef.current.onViewportChange(currentViewport());
    scheduleSelectionRect();
  }, [
    currentViewport,
    insetBottom,
    insetLeft,
    insetRight,
    insetTop,
    scheduleSelectionRect,
    selectedIds,
    selectionRect,
  ]);

  useEffect(() => {
    const app = appRef.current as (App & {
      config?: { move?: Record<string, unknown> };
      editor?: { config?: Record<string, unknown>; target?: unknown };
    }) | null;
    if (!runtimeReady || !app?.editor) return;
    if (app.config) {
      app.config.move = {
        ...(app.config.move ?? {}),
        dragEmpty: tool === 'pan',
      };
    }
    if (app.editor.config) {
      app.editor.config.boxSelect = tool === 'select' && !referencePicker;
      app.editor.config.moveable = tool === 'select' && !referencePicker;
      app.editor.config.rotateable = false;
    }
    clearSnapGuides();
    sectionChildrenDragRef.current = null;
    if (tool === 'section') {
      app.editor.target = undefined;
      selectedIdsRef.current = [];
      callbacksRef.current.onSelectIds([]);
      scheduleSelectionRect();
    }
  }, [
    clearSnapGuides,
    referencePicker,
    runtimeReady,
    scheduleSelectionRect,
    tool,
  ]);

  const changeZoom = useCallback(
    (nextZoom: number) => {
      const tree = appRef.current?.tree as unknown as
        | {
            x: number;
            y: number;
            scaleX: number;
            scaleY: number;
            forceUpdate?: () => void;
          }
        | undefined;
      const host = hostRef.current;
      if (!tree || !host) return;
      const current = Number(tree.scaleX || 1);
      const next = Math.max(0.1, Math.min(4, nextZoom));
      const anchorX =
        insetLeft + Math.max(1, host.clientWidth - insetLeft - insetRight) / 2;
      const anchorY =
        insetTop + Math.max(1, host.clientHeight - insetTop - insetBottom) / 2;
      const worldX = (anchorX - Number(tree.x || 0)) / current;
      const worldY = (anchorY - Number(tree.y || 0)) / current;
      setTreeViewport(tree, {
        x: anchorX - worldX * next,
        y: anchorY - worldY * next,
        zoom: next,
      });
      setZoom(next);
      callbacksRef.current.onViewportChange(currentViewport());
      scheduleSelectionRect();
    },
    [
      currentViewport,
      insetBottom,
      insetLeft,
      insetRight,
      insetTop,
      scheduleSelectionRect,
    ],
  );

  const fitNodes = useCallback(
    (ids?: string[]) => {
      const host = hostRef.current;
      const tree = appRef.current?.tree as unknown as
        | {
            x: number;
            y: number;
            scaleX: number;
            scaleY: number;
            forceUpdate?: () => void;
          }
        | undefined;
      if (!host || !tree) return;
      const selected = ids?.length
        ? nodesRef.current.filter((node) => ids.includes(node.id))
        : nodesRef.current;
      const bounds = boundsForNodes(selected);
      if (!bounds) {
        changeZoom(1);
        return;
      }
      const padding = ids?.length === 1 && selected.length === 1 ? 36 : 110;
      const availableWidth = Math.max(
        1,
        host.clientWidth - insetLeft - insetRight,
      );
      const availableHeight = Math.max(
        1,
        host.clientHeight - insetTop - insetBottom,
      );
      const scale = Math.max(
        0.1,
        Math.min(
          2.4,
          (availableWidth - padding * 2) / Math.max(1, bounds.width),
          (availableHeight - padding * 2) / Math.max(1, bounds.height),
        ),
      );
      setTreeViewport(tree, {
        x:
          insetLeft +
          availableWidth / 2 -
          (bounds.left + bounds.width / 2) * scale,
        y:
          insetTop +
          availableHeight / 2 -
          (bounds.top + bounds.height / 2) * scale,
        zoom: scale,
      });
      setZoom(scale);
      callbacksRef.current.onViewportChange(currentViewport());
      scheduleSelectionRect();
    },
    [
      changeZoom,
      currentViewport,
      insetBottom,
      insetLeft,
      insetRight,
      insetTop,
      scheduleSelectionRect,
    ],
  );

  const canvasCenter = useCallback(() => {
    const host = hostRef.current;
    const viewport = currentViewport();
    const availableWidth = Math.max(
      1,
      (host?.clientWidth ?? 640) - insetLeft - insetRight,
    );
    const availableHeight = Math.max(
      1,
      (host?.clientHeight ?? 480) - insetTop - insetBottom,
    );
    return {
      x: (insetLeft + availableWidth / 2 - viewport.x) / viewport.zoom,
      y: (insetTop + availableHeight / 2 - viewport.y) / viewport.zoom,
    };
  }, [
    currentViewport,
    insetBottom,
    insetLeft,
    insetRight,
    insetTop,
  ]);

  return {
    appRef: appRef as RefObject<App | null>,
    hostRef,
    runtimeReady,
    zoom,
    selectionRect,
    sectionDraftRect,
    snapGuides,
    handleAppReady,
    handleLayerCreated,
    changeZoom,
    fitNodes,
    canvasCenter,
    currentViewport,
  };
}
