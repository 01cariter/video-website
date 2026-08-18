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
import type { StudioNode, StudioViewport } from '@/lib/studio/types';
import type { StudioTool } from './studio-context';

export interface StudioFloatingRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

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
  if (!editor) return;
  const targets = ids
    .map((id) => app?.findId(id))
    .filter((target): target is IUI => Boolean(target));
  editor.select?.(targets);
  editor.target =
    targets.length === 1 ? targets[0] : targets.length > 1 ? targets : undefined;
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
    onSectionDraw,
    onContextMenu,
  });
  const sectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const sectionHandledRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [zoom, setZoom] = useState(initialViewport.zoom);
  const [selectionRect, setSelectionRect] =
    useState<StudioFloatingRect | null>(null);
  const [sectionDraftRect, setSectionDraftRect] =
    useState<StudioFloatingRect | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
    selectedIdsRef.current = selectedIds;
    toolRef.current = tool;
    callbacksRef.current = {
      onSelectIds,
      onNodesChange,
      onViewportChange,
      onBlankDoubleClick,
      onSectionDraw,
      onContextMenu,
    };
  }, [
    nodes,
    onBlankDoubleClick,
    onContextMenu,
    onNodesChange,
    onSectionDraw,
    onSelectIds,
    onViewportChange,
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

  const readNodesFromFrames = useCallback(
    () =>
      nodesRef.current.map((node) => {
        const frame = findFrame(node.id);
        if (!frame) return node;
        return {
          ...node,
          x: Math.round(Number(frame.x ?? node.x)),
          y: Math.round(Number(frame.y ?? node.y)),
          width: Math.max(40, Math.round(Number(frame.width ?? node.width))),
          height: Math.max(40, Math.round(Number(frame.height ?? node.height))),
          rotation: 0,
          zIndex: Math.round(Number(frame.zIndex ?? node.zIndex)),
        };
      }),
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

    const syncSelection = () => {
      const ids = nodeIdsFromTarget(editor.target);
      if (!sameIds(ids, selectedIdsRef.current)) {
        selectedIdsRef.current = ids;
        callbacksRef.current.onSelectIds(ids);
      }
      scheduleSelectionRect();
    };
    const beginTransform = () => {
      scheduleSelectionRect();
    };
    const syncEditorGeometry = () => {
      scheduleSelectionRect();
    };
    const endNodeTransform = () => {
      commitFrameState();
      scheduleSelectionRect();
    };
    const syncViewport = () => {
      const viewport = currentViewport();
      setZoom(viewport.zoom);
      callbacksRef.current.onViewportChange(viewport);
      scheduleSelectionRect();
    };
    const onPointerDown = (event: unknown) => {
      const targetId = nodeIdFromTarget(
        (event as { target?: unknown } | undefined)?.target,
      );
      if (toolRef.current === 'section' && !targetId) {
        sectionStartRef.current = eventCanvasPoint(event as never);
        selectAppNodes(appRef.current, []);
        selectedIdsRef.current = [];
        callbacksRef.current.onSelectIds([]);
        return;
      }
      if (toolRef.current === 'select' && targetId) {
        const source = (event as {
          origin?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean };
          nativeEvent?: {
            metaKey?: boolean;
            ctrlKey?: boolean;
            shiftKey?: boolean;
          };
        });
        const keys = source.origin || source.nativeEvent || {};
        const additive = Boolean(keys.metaKey || keys.ctrlKey || keys.shiftKey);
        const current = selectedIdsRef.current;
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
      if (nodeIdFromTarget((event as { target?: unknown })?.target)) return;
      callbacksRef.current.onBlankDoubleClick(eventCanvasPoint(event as never));
    };
    const onTap = (event: unknown) => {
      if (sectionHandledRef.current) {
        sectionHandledRef.current = false;
        return;
      }
      if (!nodeIdFromTarget((event as { target?: unknown })?.target)) {
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
      const targetId =
        nodeIdFromTarget((event as { target?: unknown })?.target) ||
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

    app.on(PointerEvent.DOWN, onPointerDown);
    app.on(PointerEvent.TAP, onTap);
    app.on(PointerEvent.DOUBLE_TAP, onDoubleTap);
    app.on(PointerEvent.MENU, onMenu);
    app.on(DragEvent.START, beginTransform);
    app.on(DragEvent.DRAG, onDrag);
    app.on(DragEvent.END, onDragEnd);
    app.on(ZoomEvent.START, beginTransform);
    app.on(ZoomEvent.ZOOM, beginTransform);
    app.on(ZoomEvent.END, syncViewport);
    app.tree.on(PropertyEvent.LEAFER_CHANGE, scheduleSelectionRect);
    app.tree.on('move', beginTransform);
    app.tree.on('move.end', syncViewport);
    editor.on(EditorEvent.SELECT, syncSelection);
    editor.on(EditorMoveEvent.MOVE, syncEditorGeometry);
    editor.on(EditorScaleEvent.SCALE, syncEditorGeometry);

    return () => {
      app.off(PointerEvent.DOWN, onPointerDown);
      app.off(PointerEvent.TAP, onTap);
      app.off(PointerEvent.DOUBLE_TAP, onDoubleTap);
      app.off(PointerEvent.MENU, onMenu);
      app.off(DragEvent.START, beginTransform);
      app.off(DragEvent.DRAG, onDrag);
      app.off(DragEvent.END, onDragEnd);
      app.off(ZoomEvent.START, beginTransform);
      app.off(ZoomEvent.ZOOM, beginTransform);
      app.off(ZoomEvent.END, syncViewport);
      app.tree.off(PropertyEvent.LEAFER_CHANGE, scheduleSelectionRect);
      app.tree.off('move', beginTransform);
      app.tree.off('move.end', syncViewport);
      editor.off(EditorEvent.SELECT, syncSelection);
      editor.off(EditorMoveEvent.MOVE, syncEditorGeometry);
      editor.off(EditorScaleEvent.SCALE, syncEditorGeometry);
    };
  }, [
    commitFrameState,
    currentViewport,
    runtimeReady,
    scheduleSelectionRect,
  ]);

  useEffect(() => {
    selectAppNodes(appRef.current, selectedIds);
    scheduleSelectionRect();
  }, [scheduleSelectionRect, selectedIds]);

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
      app.editor.config.boxSelect = tool === 'select';
      app.editor.config.moveable = tool === 'select';
      app.editor.config.rotateable = false;
    }
    if (tool === 'section') {
      app.editor.target = undefined;
      selectedIdsRef.current = [];
      callbacksRef.current.onSelectIds([]);
      scheduleSelectionRect();
    }
  }, [runtimeReady, scheduleSelectionRect, tool]);

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
      const padding = 110;
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
    handleAppReady,
    handleLayerCreated,
    changeZoom,
    fitNodes,
    canvasCenter,
    currentViewport,
  };
}
