'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { LoaderCircle, UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { DragEvent as ReactDragEvent } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Frame, Leafer } from '@/lib/leafer-react';
import { sizeForAspect } from '@/lib/studio/geometry';
import {
  studioMediaKind,
  uploadStudioMedia,
} from '@/lib/studio/media-upload';
import { createBlankNode, saveStudioProject } from '@/lib/studio/store';
import {
  getStudioProjectSynced,
  saveStudioProjectSynced,
} from '@/lib/studio/client-store';
import type {
  StudioCanvasOperation,
  StudioNode,
  StudioNodeData,
  StudioNodeKind,
  StudioProject,
  StudioViewport,
} from '@/lib/studio/types';
import { cn } from '@/lib/utils';
import AgentPanel from './AgentPanel';
import CanvasContextMenu from './CanvasContextMenu';
import {
  LayerPanel,
  LeftToolbar,
  NodeOverlays,
  ZoomControl,
} from './CanvasChrome';
import StudioHeader from './StudioHeader';
import { StudioCanvasNode } from './nodes';
import {
  StudioCanvasProvider,
  type StudioCanvasApi,
  type StudioTool,
} from './studio-context';
import {
  useLeaferStudioRuntime,
  type StudioCanvasMenuState,
} from './useLeaferStudioRuntime';

interface StudioWorkspaceProps {
  projectId: string;
  freeCreditModelsOnly: boolean;
}

interface AddNodeExtras {
  prompt?: string;
  title?: string;
  text?: string;
  data?: Partial<StudioNodeData>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

const STUDIO_DROP_FILE_LIMIT = 8;

const EDITOR_CONFIG = {
  hideOnMove: false,
  skewable: false,
  rotateable: false,
  flipable: false,
  bright: true,
  stroke: '#2f6f7e',
  strokeWidth: 1,
  pointFill: '#fffdf9',
  pointRadius: 2,
  pointSize: 8,
};

function requestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function uploadedMediaSize(
  width: number | null,
  height: number | null,
  kind: 'image' | 'video',
) {
  if (!width || !height || width <= 0 || height <= 0) {
    return kind === 'video'
      ? { width: 400, height: 225 }
      : { width: 340, height: 280 };
  }
  const ratio = width / height;
  const maxWidth = 420;
  const maxHeight = 360;
  let nextWidth = maxWidth;
  let nextHeight = nextWidth / ratio;
  if (nextHeight > maxHeight) {
    nextHeight = maxHeight;
    nextWidth = nextHeight * ratio;
  }
  return {
    width: Math.max(120, Math.round(nextWidth)),
    height: Math.max(120, Math.round(nextHeight)),
  };
}

function operationFromOutput(output: unknown): StudioCanvasOperation[] {
  if (!output || typeof output !== 'object') return [];
  const value = output as Record<string, unknown>;
  if (Array.isArray(value.operations)) {
    return value.operations.filter(Boolean) as StudioCanvasOperation[];
  }
  if (value.operation && typeof value.operation === 'object') {
    return [value.operation as StudioCanvasOperation];
  }
  if (typeof value.type === 'string') {
    return [value as unknown as StudioCanvasOperation];
  }
  if (
    typeof value.kind === 'string' &&
    ['image', 'video', 'text', 'section'].includes(value.kind)
  ) {
    return [
      {
        type: 'add_node',
        node: {
          kind: value.kind as StudioNodeKind,
          prompt:
            typeof value.prompt === 'string' ? value.prompt : undefined,
          title: typeof value.title === 'string' ? value.title : undefined,
          text: typeof value.text === 'string' ? value.text : undefined,
        },
      },
    ];
  }
  return [];
}

function applyProcessedTools(
  messages: UIMessage[],
  seen: Set<string>,
  applyOperation: (operation: StudioCanvasOperation) => void,
) {
  for (const message of messages) {
    for (const part of message.parts) {
      if (!part.type.startsWith('tool-')) continue;
      const id = 'toolCallId' in part ? String(part.toolCallId) : '';
      const state = 'state' in part ? String(part.state) : '';
      if (!id || seen.has(id) || state !== 'output-available') continue;
      seen.add(id);
      const output = 'output' in part ? part.output : null;
      for (const operation of operationFromOutput(output)) {
        applyOperation(operation);
      }
    }
  }
}

function CanvasWorkspace({
  project,
  freeCreditModelsOnly,
}: {
  project: StudioProject;
  freeCreditModelsOnly: boolean;
}) {
  const persistTimer = useRef<number | null>(null);
  const localPersistTimer = useRef<number | null>(null);
  const dragDepth = useRef(0);
  const generating = useRef(new Set<string>());
  const seenTools = useRef(new Set<string>());
  const [nodes, setNodes] = useState(project.nodes);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewport, setViewport] = useState(project.viewport);
  const [title, setTitle] = useState(project.title);
  const [agentOpen, setAgentOpen] = useState(
    () =>
      project.agentOpen &&
      (typeof window === 'undefined' ||
        window.matchMedia('(min-width: 768px)').matches),
  );
  const [tool, setTool] = useState<StudioTool>('select');
  const [layersOpen, setLayersOpen] = useState(false);
  const [menu, setMenu] = useState<StudioCanvasMenuState | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const nodesRef = useRef(nodes);
  const viewportRef = useRef(viewport);
  const titleRef = useRef(title);
  const agentOpenRef = useRef(agentOpen);
  const messagesRef = useRef(project.messages);
  const addNodeRef = useRef<
    (kind: StudioNodeKind, extras?: AddNodeExtras) => string
  >(() => '');
  const canvasCenterRef = useRef(() => ({ x: 320, y: 240 }));

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const commitNodes = useCallback(
    (update: (current: StudioNode[]) => StudioNode[]) => {
      const next = update(nodesRef.current);
      nodesRef.current = next;
      setNodes(next);
      return next;
    },
    [],
  );

  const updateAgentOpen = useCallback(
    (update: boolean | ((current: boolean) => boolean)) => {
      const next =
        typeof update === 'function' ? update(agentOpenRef.current) : update;
      agentOpenRef.current = next;
      setAgentOpen(next);
    },
    [],
  );

  const selectIds = useCallback((ids: string[]) => {
    const existing = new Set(nodesRef.current.map((node) => node.id));
    setSelectedIds(ids.filter((id, index) => existing.has(id) && ids.indexOf(id) === index));
  }, []);

  const updateNode = useCallback(
    (id: string, patch: Partial<StudioNode>) => {
      commitNodes((current) =>
        current.map((node) =>
          node.id === id
            ? {
                ...node,
                ...patch,
                rotation: 0,
                data: patch.data
                  ? { ...node.data, ...patch.data, kind: node.type }
                  : node.data,
              }
            : node,
        ),
      );
    },
    [commitNodes],
  );

  const updateNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      commitNodes((current) =>
        current.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...patch, kind: node.type } }
            : node,
        ),
      );
    },
    [commitNodes],
  );

  const setNodeAspect = useCallback((id: string, aspect: string) => {
    commitNodes((current) =>
      current.map((node) => {
        if (node.id !== id || node.type === 'section') return node;
        const next = sizeForAspect(aspect, node.type);
        return {
          ...node,
          x: node.x + (node.width - next.width) / 2,
          y: node.y + (node.height - next.height) / 2,
          width: next.width,
          height: next.height,
          data: { ...node.data, aspect },
        };
      }),
    );
  }, [commitNodes]);

  const generateNode = useCallback(
    async (id: string) => {
      if (generating.current.has(id)) return;
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node || node.type === 'section') return;
      if (!node.data.prompt.trim()) {
        updateNodeData(id, { error: 'Add a generation prompt first.' });
        return;
      }

      generating.current.add(id);
      updateNodeData(id, {
        status: 'generating',
        error: undefined,
      });

      try {
        const body = {
          projectId: project.id,
          nodeId: node.id,
          requestId: requestId(),
          prompt: node.data.prompt,
          current: node.data.text || '',
          modelId: node.data.modelId,
          aspect: node.data.aspect,
          n: node.data.n,
          refSrc: node.data.refSrc,
          duration: node.data.duration,
          videoResolution: node.data.videoResolution,
          generateAudio: node.data.generateAudio,
          reasoningEffort: node.data.reasoningEffort,
        };
        const endpoint =
          node.type === 'text'
            ? '/api/studio/text'
            : node.type === 'video'
              ? '/api/studio/video'
              : '/api/studio/image';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as {
          text?: string;
          url?: string;
          urls?: string[];
          error?: string;
          balance?: number;
        };
        if (!response.ok) {
          throw new Error(payload.error || 'Generation failed.');
        }
        if (typeof payload.balance === 'number') {
          window.dispatchEvent(
            new CustomEvent('credits:changed', { detail: payload.balance }),
          );
        }

        if (node.type === 'text') {
          updateNodeData(id, {
            status: 'ready',
            text: payload.text || '',
            error: undefined,
          });
          return;
        }

        const urls =
          payload.urls?.filter(Boolean) || (payload.url ? [payload.url] : []);
        if (!urls.length) throw new Error('The generation service returned no assets.');
        updateNodeData(id, {
          status: 'ready',
          src: urls[0],
          error: undefined,
        });
        if (urls.length > 1) {
          commitNodes((current) => {
            const source = current.find((item) => item.id === id);
            if (!source) return current;
            const top = Math.max(0, ...current.map((item) => item.zIndex));
            const copies = urls.slice(1).map((url, index) => {
              const copy = createBlankNode(
                source.type,
                {
                  x: source.x + (index + 1) * 36,
                  y: source.y + (index + 1) * 36,
                },
                {
                  ...source.data,
                  src: url,
                  status: 'ready',
                  title: `${source.data.title} ${index + 2}`,
                },
              );
              return {
                ...copy,
                width: source.width,
                height: source.height,
                zIndex: top + index + 1,
              };
            });
            return current.concat(copies);
          });
        }
      } catch (error) {
        updateNodeData(id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Generation failed.',
        });
      } finally {
        generating.current.delete(id);
      }
    },
    [commitNodes, project.id, updateNodeData],
  );

  const addNode = useCallback(
    (kind: StudioNodeKind, extras: AddNodeExtras = {}) => {
      const center = canvasCenterRef.current();
      const position =
        extras.position || {
          x: center.x - (extras.size?.width ?? 280) / 2,
          y: center.y - (extras.size?.height ?? 220) / 2,
        };
      const node = createBlankNode(kind, position, {
        ...extras.data,
        prompt: extras.prompt,
        title: extras.title,
        text: extras.text,
      });
      const top = Math.max(0, ...nodesRef.current.map((item) => item.zIndex));
      const next: StudioNode = {
        ...node,
        width: extras.size?.width ?? node.width,
        height: extras.size?.height ?? node.height,
        zIndex: kind === 'section' ? -1 : top + 1,
      };
      commitNodes((current) => current.concat(next));
      setSelectedIds([next.id]);
      setTool('select');
      if (kind !== 'section' && extras.prompt?.trim()) {
        window.setTimeout(() => void generateNode(next.id), 0);
      }
      return next.id;
    },
    [commitNodes, generateNode],
  );
  useEffect(() => {
    addNodeRef.current = addNode;
  }, [addNode]);

  const removeNodes = useCallback((ids: string[]) => {
    const drop = new Set(ids);
    commitNodes((current) => current.filter((node) => !drop.has(node.id)));
    setSelectedIds((current) => current.filter((id) => !drop.has(id)));
  }, [commitNodes]);

  const removeNode = useCallback(
    (id: string) => {
      removeNodes([id]);
    },
    [removeNodes],
  );

  const duplicateNodes = useCallback((ids: string[]) => {
    const pick = new Set(ids);
    const sources = nodesRef.current.filter((node) => pick.has(node.id));
    if (!sources.length) return;
    const top = Math.max(0, ...nodesRef.current.map((node) => node.zIndex));
    const copies = sources.map((source, index) => {
      const copy = createBlankNode(
        source.type,
        { x: source.x + 36, y: source.y + 36 },
        source.data,
      );
      return {
        ...copy,
        width: source.width,
        height: source.height,
        rotation: 0,
        zIndex: source.type === 'section' ? source.zIndex : top + index + 1,
        data: { ...source.data, title: `${source.data.title} copy` },
      };
    });
    commitNodes((current) => current.concat(copies));
    setSelectedIds(copies.map((node) => node.id));
  }, [commitNodes]);

  const duplicateNode = useCallback(
    (id: string) => duplicateNodes([id]),
    [duplicateNodes],
  );

  const bringToFront = useCallback((id: string) => {
    const top = Math.max(0, ...nodesRef.current.map((node) => node.zIndex));
    updateNode(id, { zIndex: top + 1 });
  }, [updateNode]);

  const sendToBack = useCallback((id: string) => {
    const bottom = Math.min(-1, ...nodesRef.current.map((node) => node.zIndex));
    updateNode(id, { zIndex: bottom - 1 });
  }, [updateNode]);

  const toggleNodeHidden = useCallback(
    (id: string) => {
      const node = nodesRef.current.find((item) => item.id === id);
      if (node) updateNodeData(id, { hidden: !node.data.hidden });
    },
    [updateNodeData],
  );

  const toggleNodeLocked = useCallback(
    (id: string) => {
      const node = nodesRef.current.find((item) => item.id === id);
      if (node) updateNodeData(id, { locked: !node.data.locked });
    },
    [updateNodeData],
  );

  const {
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
  } = useLeaferStudioRuntime({
    nodes,
    selectedIds,
    tool,
    initialViewport: project.viewport,
    onSelectIds: selectIds,
    onNodesChange: (next) => {
      nodesRef.current = next;
      setNodes(next);
    },
    onViewportChange: (next) => {
      viewportRef.current = next;
      setViewport(next);
    },
    onBlankDoubleClick: (point) =>
      addNodeRef.current('image', {
        position: { x: point.x - 150, y: point.y - 150 },
      }),
    onSectionDraw: (rect) =>
      addNodeRef.current('section', {
        position: { x: rect.x, y: rect.y },
        size: { width: rect.width, height: rect.height },
      }),
    onContextMenu: setMenu,
    viewportInsets: {
      left: layersOpen ? 264 : 0,
    },
  });
  useEffect(() => {
    canvasCenterRef.current = canvasCenter;
  }, [canvasCenter]);

  const addUploadedFiles = useCallback(
    async (files: File[], point: { x: number; y: number }) => {
      const accepted = files
        .map((file) => ({ file, kind: studioMediaKind(file) }))
        .filter(
          (
            item,
          ): item is {
            file: File;
            kind: 'image' | 'video';
          } => Boolean(item.kind),
        )
        .slice(0, STUDIO_DROP_FILE_LIMIT);

      if (!accepted.length) {
        setUploadError('Drop an image, MP4, WebM, or MOV file.');
        return;
      }
      setUploadError(
        files.length > STUDIO_DROP_FILE_LIMIT
          ? `Only the first ${STUDIO_DROP_FILE_LIMIT} files were added.`
          : '',
      );
      setUploadingCount((count) => count + accepted.length);

      await Promise.all(
        accepted.map(async ({ file, kind }, index) => {
          const initialSize = uploadedMediaSize(null, null, kind);
          const id = addNode(kind, {
            title: file.name,
            position: {
              x: point.x - initialSize.width / 2 + index * 28,
              y: point.y - initialSize.height / 2 + index * 28,
            },
            size: initialSize,
            data: { status: 'generating' },
          });
          try {
            const uploaded = await uploadStudioMedia(file);
            const size = uploadedMediaSize(
              uploaded.width,
              uploaded.height,
              kind,
            );
            updateNode(id, { width: size.width, height: size.height });
            updateNodeData(id, {
              src: uploaded.url,
              status: 'ready',
              error: undefined,
              uploadMime: uploaded.mime,
              sourceWidth: uploaded.width,
              sourceHeight: uploaded.height,
              sourceDuration: uploaded.durationSeconds,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Upload failed.';
            updateNodeData(id, { status: 'error', error: message });
            setUploadError(message);
          } finally {
            setUploadingCount((count) => Math.max(0, count - 1));
          }
        }),
      );
    },
    [addNode, updateNode, updateNodeData],
  );

  const onCanvasDragEnter = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDropActive(true);
    },
    [],
  );

  const onCanvasDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [],
  );

  const onCanvasDragLeave = useCallback(
    (_event: ReactDragEvent<HTMLDivElement>) => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDropActive(false);
    },
    [],
  );

  const onCanvasDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepth.current = 0;
      setDropActive(false);
      if (!event.dataTransfer.files.length) {
        setUploadError('No media files were found in that drop.');
        return;
      }
      const rect = hostRef.current?.getBoundingClientRect();
      const viewport = currentViewport();
      const point = {
        x: ((rect ? event.clientX - rect.left : event.clientX) - viewport.x) /
          viewport.zoom,
        y: ((rect ? event.clientY - rect.top : event.clientY) - viewport.y) /
          viewport.zoom,
      };
      void addUploadedFiles(Array.from(event.dataTransfer.files), point);
    },
    [addUploadedFiles, currentViewport, hostRef],
  );

  const applyOperation = useCallback(
    (operation: StudioCanvasOperation) => {
      if (operation.type === 'add_node') {
        addNode(operation.node.kind, {
          prompt: operation.node.prompt,
          title: operation.node.title,
          text: operation.node.text,
          position:
            typeof operation.node.x === 'number' &&
            typeof operation.node.y === 'number'
              ? { x: operation.node.x, y: operation.node.y }
              : undefined,
          size:
            typeof operation.node.width === 'number' &&
            typeof operation.node.height === 'number'
              ? {
                  width: operation.node.width,
                  height: operation.node.height,
                }
              : undefined,
        });
        return;
      }
      if (operation.type === 'remove_nodes') {
        removeNodes(operation.ids);
        return;
      }
      const { x, y, width, height, rotation: _rotation, ...dataPatch } =
        operation.patch;
      const geometry: Partial<StudioNode> = {};
      if (typeof x === 'number') geometry.x = x;
      if (typeof y === 'number') geometry.y = y;
      if (typeof width === 'number') geometry.width = width;
      if (typeof height === 'number') geometry.height = height;
      updateNode(operation.id, geometry);
      if (Object.keys(dataPatch).length) {
        updateNodeData(operation.id, dataPatch);
      }
    },
    [addNode, removeNodes, updateNode, updateNodeData],
  );

  const buildProjectSnapshot = useCallback(
    (nextMessages = messagesRef.current): StudioProject => ({
      ...project,
      title: titleRef.current.trim() || 'Untitled project',
      nodes: nodesRef.current,
      viewport: viewportRef.current,
      messages: nextMessages,
      pendingPrompt: undefined,
      agentOpen: agentOpenRef.current,
    }),
    [project],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/studio/chat',
        body: () => ({
          requestId: requestId(),
          projectId: project.id,
          canvas: nodes.map((node) => ({
            id: node.id,
            kind: node.type,
            title: node.data.title,
            prompt: node.data.prompt,
            status: node.data.status,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
          })),
          selectedIds,
        }),
      }),
    [nodes, project.id, selectedIds],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: project.id,
    transport,
    messages: project.messages,
    onFinish: ({ messages: next }) => {
      window.dispatchEvent(new Event('credits:changed'));
      messagesRef.current = next;
      void saveStudioProjectSynced(buildProjectSnapshot(next));
    },
  });

  useEffect(() => {
    messagesRef.current = messages;
    applyProcessedTools(messages, seenTools.current, applyOperation);
  }, [applyOperation, messages]);

  useEffect(() => {
    if (localPersistTimer.current) {
      window.clearTimeout(localPersistTimer.current);
    }
    localPersistTimer.current = window.setTimeout(() => {
      saveStudioProject(buildProjectSnapshot(messages));
    }, 60);
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      void saveStudioProjectSynced(buildProjectSnapshot(messages));
    }, 420);
    return () => {
      if (localPersistTimer.current) {
        window.clearTimeout(localPersistTimer.current);
      }
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [
    agentOpen,
    buildProjectSnapshot,
    messages,
    nodes,
    title,
    viewport,
  ]);

  useEffect(() => {
    const flushLocal = () => {
      saveStudioProject(buildProjectSnapshot());
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushLocal();
    };
    window.addEventListener('pagehide', flushLocal);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushLocal);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushLocal();
    };
  }, [buildProjectSnapshot]);

  const consumedPrompt = useRef(false);
  useEffect(() => {
    if (consumedPrompt.current || !project.pendingPrompt) return;
    consumedPrompt.current = true;
    const kind: StudioNodeKind = /video|clip|shot|storyboard/i.test(
      project.pendingPrompt,
    )
      ? 'video'
      : 'image';
    addNode(kind, {
      prompt: project.pendingPrompt,
      title: project.title,
    });
    void sendMessage({
      text: `Develop this creative direction and continue organizing the canvas: ${project.pendingPrompt}`,
    });
  }, [
    addNode,
    project.pendingPrompt,
    project.title,
    sendMessage,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateNodes(selectedIds);
        return;
      }
      if (command && event.key === '0') {
        event.preventDefault();
        fitNodes();
        return;
      }
      if (event.altKey || command) return;
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        removeNodes(selectedIds);
      } else if (event.key === 'v' || event.key === 'V') {
        setTool('select');
      } else if (event.key === 'h' || event.key === 'H') {
        setTool('pan');
      } else if (event.key === 'f' || event.key === 'F') {
        setTool('section');
      } else if (event.key === 'Escape') {
        setMenu(null);
        selectIds([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [duplicateNodes, fitNodes, removeNodes, selectIds, selectedIds]);

  const api = useMemo<StudioCanvasApi>(
    () => ({
      nodes,
      selectedIds,
      freeCreditModelsOnly,
      addNode,
      generateNode,
      removeNode,
      removeNodes,
      duplicateNode,
      duplicateNodes,
      bringToFront,
      sendToBack,
      updateNodeData,
      updateNode,
      setNodeAspect,
      selectIds,
      toggleNodeHidden,
      toggleNodeLocked,
      tool,
      setTool,
      zoom,
      changeZoom,
      fitView: fitNodes,
    }),
    [
      addNode,
      bringToFront,
      duplicateNode,
      duplicateNodes,
      generateNode,
      nodes,
      removeNode,
      removeNodes,
      changeZoom,
      fitNodes,
      freeCreditModelsOnly,
      selectIds,
      selectedIds,
      sendToBack,
      setNodeAspect,
      toggleNodeHidden,
      toggleNodeLocked,
      tool,
      updateNode,
      updateNodeData,
      zoom,
    ],
  );

  return (
    <StudioCanvasProvider value={api}>
      <div className="studio-shell relative flex h-dvh overflow-hidden bg-background text-foreground">
        <div className="flex min-w-0 flex-1 flex-col">
          <StudioHeader
            title={title}
            onTitleChange={(next) => {
              titleRef.current = next;
              setTitle(next);
            }}
            agentOpen={agentOpen}
            onToggleAgent={() => updateAgentOpen((open) => !open)}
          />
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={hostRef}
              data-testid="studio-leafer-canvas"
              className="studio-canvas-surface absolute inset-0 overflow-hidden"
              onDragEnter={onCanvasDragEnter}
              onDragOver={onCanvasDragOver}
              onDragLeave={onCanvasDragLeave}
              onDrop={onCanvasDrop}
            >
            <Leafer
              fill="transparent"
              editor={EDITOR_CONFIG}
              wheel={{ preventDefault: true }}
              move={{ dragEmpty: tool === 'pan' }}
              zoom={{ min: 0.1, max: 4 }}
              onAppReady={handleAppReady}
              className={cn(
                'h-full w-full overflow-hidden',
                tool === 'pan' && 'cursor-grab active:cursor-grabbing',
                tool === 'section' && 'cursor-crosshair',
              )}
            >
              <Frame
                id="studio-node-layer"
                name="nodes"
                fill="transparent"
                hitSelf={false}
                isSnap={false}
                onCreated={handleLayerCreated}
              >
                {[...nodes]
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map((node) => (
                    <StudioCanvasNode key={node.id} node={node} />
                  ))}
              </Frame>
            </Leafer>

            {!runtimeReady ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                Preparing the infinite canvas…
              </div>
            ) : null}

            {dropActive ? (
              <div
                data-testid="studio-media-drop-overlay"
                className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-3xl border-2 border-dashed border-primary/65 bg-background/88 shadow-[0_24px_80px_-42px_rgba(0,0,0,.65)] backdrop-blur-md"
              >
                <div className="flex max-w-sm flex-col items-center px-6 text-center">
                  <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                    <UploadCloud className="size-6" />
                  </span>
                  <strong className="mt-4 text-lg tracking-[-0.02em]">
                    Drop media onto the canvas
                  </strong>
                  <span className="mt-1.5 text-sm text-muted-foreground">
                    Images and videos become editable canvas nodes.
                  </span>
                </div>
              </div>
            ) : null}

            {uploadingCount || uploadError ? (
              <div
                className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2"
                role={uploadError ? 'alert' : 'status'}
              >
                <div className="flex max-w-[min(460px,calc(100vw-32px))] items-center gap-2 rounded-full border bg-card/95 px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur-xl">
                  {uploadingCount ? (
                    <LoaderCircle className="size-3.5 animate-spin text-primary" />
                  ) : null}
                  <span className={uploadError ? 'text-destructive' : ''}>
                    {uploadError ||
                      `Uploading ${uploadingCount} media ${
                        uploadingCount === 1 ? 'file' : 'files'
                      }…`}
                  </span>
                </div>
              </div>
            ) : null}

            {snapGuides.map((guide, index) => (
              <div
                key={`${guide.axis}-${index}`}
                data-testid={`studio-snap-guide-${guide.axis}`}
                className="pointer-events-none absolute z-10 bg-[#2f6f7e] shadow-[0_0_0_0.5px_rgba(47,111,126,0.24)]"
                style={
                  guide.axis === 'x'
                    ? {
                        left: Math.round(guide.position),
                        top: Math.round(guide.start),
                        width: 1,
                        height: Math.max(1, Math.round(guide.end - guide.start)),
                      }
                    : {
                        left: Math.round(guide.start),
                        top: Math.round(guide.position),
                        width: Math.max(1, Math.round(guide.end - guide.start)),
                        height: 1,
                      }
                }
              />
            ))}

            {sectionDraftRect ? (
              <div
                className="pointer-events-none absolute rounded-xl border border-dashed border-[#2f6f7e]/80 bg-[#2f6f7e]/5"
                style={{
                  left: sectionDraftRect.left,
                  top: sectionDraftRect.top,
                  width: sectionDraftRect.width,
                  height: sectionDraftRect.height,
                }}
              />
            ) : null}

            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
              <div className="pointer-events-auto">
                <LeftToolbar
                  layersOpen={layersOpen}
                  onToggleLayers={() => setLayersOpen((open) => !open)}
                />
              </div>
            </div>
            <LayerPanel
              open={layersOpen}
              onClose={() => setLayersOpen(false)}
            />
            <div className="pointer-events-none absolute right-3 bottom-3 z-20">
              <div className="pointer-events-auto">
                <ZoomControl />
              </div>
            </div>
            <NodeOverlays
              stageRef={hostRef}
              selectionRect={selectionRect}
            />
            <CanvasContextMenu
              menu={menu}
              onClose={() => setMenu(null)}
            />
            </div>
          </div>
        </div>
        <AgentPanel
          open={agentOpen}
          onClose={() => updateAgentOpen(false)}
          title={title}
          messages={messages}
          status={status}
          error={error}
          onSend={(text) => void sendMessage({ text })}
          onStop={() => stop()}
        />
      </div>
    </StudioCanvasProvider>
  );
}

export default function StudioWorkspace({
  projectId,
  freeCreditModelsOnly,
}: StudioWorkspaceProps) {
  const router = useRouter();
  const [project, setProject] = useState<StudioProject | null | undefined>();

  useEffect(() => {
    let active = true;
    void getStudioProjectSynced(projectId).then((value) => {
      if (active) setProject(value);
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  if (project === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted-foreground">
        Opening canvas…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="grid min-h-dvh place-items-center gap-3 text-muted-foreground">
        <p>Project not found.</p>
        <button
          type="button"
          className="rounded-full bg-primary px-3.5 py-2 font-bold text-primary-foreground"
          onClick={() => router.push('/studio')}
        >
          Back to Creator Studio
        </button>
      </div>
    );
  }

  return (
    <CanvasWorkspace
      project={project}
      freeCreditModelsOnly={freeCreditModelsOnly}
    />
  );
}
