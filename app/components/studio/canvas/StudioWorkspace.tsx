'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Frame, Leafer } from '@/lib/leafer-react';
import { sizeForAspect } from '@/lib/studio/geometry';
import { createBlankNode } from '@/lib/studio/store';
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
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

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
  const nodesRef = useRef(nodes);
  const addNodeRef = useRef<
    (kind: StudioNodeKind, extras?: AddNodeExtras) => string
  >(() => '');
  const canvasCenterRef = useRef(() => ({ x: 320, y: 240 }));

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const selectIds = useCallback((ids: string[]) => {
    const existing = new Set(nodesRef.current.map((node) => node.id));
    setSelectedIds(ids.filter((id, index) => existing.has(id) && ids.indexOf(id) === index));
  }, []);

  const updateNode = useCallback(
    (id: string, patch: Partial<StudioNode>) => {
      setNodes((current) =>
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
    [],
  );

  const updateNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...patch, kind: node.type } }
            : node,
        ),
      );
    },
    [],
  );

  const setNodeAspect = useCallback((id: string, aspect: string) => {
    setNodes((current) =>
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
  }, []);

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
          setNodes((current) => {
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
    [project.id, updateNodeData],
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
      setNodes((current) => current.concat(next));
      nodesRef.current = nodesRef.current.concat(next);
      setSelectedIds([next.id]);
      setTool('select');
      if (kind !== 'section' && extras.prompt?.trim()) {
        window.setTimeout(() => void generateNode(next.id), 0);
      }
      return next.id;
    },
    [generateNode],
  );
  useEffect(() => {
    addNodeRef.current = addNode;
  }, [addNode]);

  const removeNodes = useCallback((ids: string[]) => {
    const drop = new Set(ids);
    setNodes((current) => current.filter((node) => !drop.has(node.id)));
    setSelectedIds((current) => current.filter((id) => !drop.has(id)));
  }, []);

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
    setNodes((current) => current.concat(copies));
    setSelectedIds(copies.map((node) => node.id));
  }, []);

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
  } = useLeaferStudioRuntime({
    nodes,
    selectedIds,
    tool,
    initialViewport: project.viewport,
    onSelectIds: selectIds,
    onNodesChange: setNodes,
    onViewportChange: setViewport,
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
      void saveStudioProjectSynced({
        ...project,
        title,
        nodes,
        viewport,
        messages: next,
        pendingPrompt: undefined,
        agentOpen,
      });
    },
  });

  useEffect(() => {
    applyProcessedTools(messages, seenTools.current, applyOperation);
  }, [applyOperation, messages]);

  useEffect(() => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      void saveStudioProjectSynced({
        ...project,
        title: title.trim() || 'Untitled project',
        nodes,
        viewport,
        messages,
        pendingPrompt: undefined,
        agentOpen,
      });
    }, 320);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [agentOpen, messages, nodes, project, title, viewport]);

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
            onTitleChange={setTitle}
            agentOpen={agentOpen}
            onToggleAgent={() => setAgentOpen((open) => !open)}
          />
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={hostRef}
              data-testid="studio-leafer-canvas"
              className="studio-canvas-surface absolute inset-0 overflow-hidden"
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
          onClose={() => setAgentOpen(false)}
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
