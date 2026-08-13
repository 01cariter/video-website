'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Background,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import '@xyflow/react/dist/style.css';
import { sizeForAspect } from '@/lib/studio/geometry';
import { createBlankNode, getStudioProject, updateStudioGraph } from '@/lib/studio/store';
import type { StudioNode, StudioNodeKind, StudioProject } from '@/lib/studio/types';
import AgentPanel from './AgentPanel';
import CanvasContextMenu, { type CanvasMenuState } from './CanvasContextMenu';
import { LeftToolbar, NodeOverlays, ZoomControl } from './CanvasChrome';
import StudioHeader from './StudioHeader';
import { studioNodeTypes } from './nodes';
import { StudioCanvasProvider, type StudioCanvasApi, type StudioTool } from './studio-context';
import { cn } from '@/lib/utils';

interface StudioWorkspaceProps {
  projectId: string;
}

function applyProcessedTools(
  messages: UIMessage[],
  seen: Set<string>,
  addNode: StudioCanvasApi['addNode'],
) {
  for (const message of messages) {
    for (const part of message.parts) {
      if (!part.type.startsWith('tool-')) continue;
      const id = 'toolCallId' in part ? String(part.toolCallId) : '';
      const state = 'state' in part ? String(part.state) : '';
      if (!id || seen.has(id) || state !== 'output-available') continue;
      const output = 'output' in part ? (part.output as { kind?: StudioNodeKind; prompt?: string; title?: string; text?: string }) : null;
      if (!output?.kind) continue;
      seen.add(id);
      addNode(output.kind, {
        prompt: output.prompt,
        title: output.title,
        text: output.text,
      });
    }
  }
}

function CanvasInner({ project }: { project: StudioProject }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const seenTools = useRef(new Set<string>());
  const persistTimer = useRef<number | null>(null);
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(project.nodes);
  const [edges, setEdges] = useEdgesState([]);
  const [title, setTitle] = useState(project.title);
  const [agentOpen, setAgentOpen] = useState(
    () => project.agentOpen && (typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches),
  );
  const [tool, setTool] = useState<StudioTool>('select');
  const [menu, setMenu] = useState<CanvasMenuState | null>(null);
  const generating = useRef(new Set<string>());
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const persist = useCallback(
    (patch: Partial<StudioProject>) => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => {
        updateStudioGraph(project.id, {
          nodes: nodes.map((node) => ({ ...node, selected: false })),
          edges,
          viewport: getViewport(),
          title,
          agentOpen,
          ...patch,
        });
      }, 280);
    },
    [agentOpen, edges, getViewport, nodes, project.id, title],
  );

  useEffect(() => {
    persist({});
  }, [nodes, edges, title, agentOpen, persist]);

  const updateNodeData = useCallback((id: string, patch: Record<string, unknown>) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    );
  }, [setNodes]);

  const setNodeAspect = useCallback((id: string, aspect: string) => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== id) return node;
        const next = sizeForAspect(aspect, node.data.kind);
        const prevW = node.width ?? Number(node.style?.width) ?? next.width;
        const prevH = node.height ?? Number(node.style?.height) ?? next.height;
        return {
          ...node,
          width: next.width,
          height: next.height,
          style: { ...node.style, width: next.width, height: next.height },
          position: {
            x: node.position.x + (prevW - next.width) / 2,
            y: node.position.y + (prevH - next.height) / 2,
          },
          data: { ...node.data, aspect },
        };
      }),
    );
  }, [setNodes]);

  const generateNode = useCallback(
    async (id: string) => {
      if (generating.current.has(id)) return;
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node) return;
      generating.current.add(id);
      nodesRef.current = nodesRef.current.map((item) =>
        item.id === id ? { ...item, data: { ...item.data, status: 'generating', error: undefined } } : item,
      );
      updateNodeData(id, { status: 'generating', error: undefined });
      try {
        if (node.data.kind === 'text') {
          const response = await fetch('/api/studio/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: node.data.prompt,
              current: node.data.text || '',
              reasoningEffort: node.data.reasoningEffort,
            }),
          });
          const payload = (await response.json()) as { text?: string; error?: string };
          if (!response.ok) throw new Error(payload.error || '文本生成失败');
          updateNodeData(id, { status: 'ready', text: payload.text || '' });
        } else {
          const endpoint = node.data.kind === 'video' ? '/api/studio/video' : '/api/studio/image';
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: node.data.prompt,
              aspect: node.data.aspect,
              n: node.data.n,
              refSrc: node.data.refSrc,
              duration: node.data.duration,
              videoResolution: node.data.videoResolution,
              generateAudio: node.data.generateAudio,
            }),
          });
          const payload = (await response.json()) as { url?: string; urls?: string[]; error?: string };
          if (!response.ok) throw new Error(payload.error || '生成失败');
          const urls = payload.urls?.filter(Boolean) || (payload.url ? [payload.url] : []);
          updateNodeData(id, { status: 'ready', src: urls[0] });
          if (urls.length > 1) {
            setNodes((current) => {
              const source = current.find((item) => item.id === id);
              if (!source) return current;
              return current.concat(
                urls.slice(1).map((url, index) =>
                  createBlankNode(
                    source.data.kind,
                    { x: source.position.x + (index + 1) * 36, y: source.position.y + (index + 1) * 36 },
                    { ...source.data, src: url, status: 'ready', title: `${source.data.title} ${index + 2}` },
                  ),
                ),
              );
            });
          }
        }
      } catch (error) {
        updateNodeData(id, {
          status: 'error',
          error: error instanceof Error ? error.message : '生成失败',
        });
      } finally {
        generating.current.delete(id);
      }
    },
    [setNodes, updateNodeData],
  );

  const addNode = useCallback(
    (kind: StudioNodeKind, extras?: { prompt?: string; title?: string; text?: string; position?: { x: number; y: number } }) => {
      const { position: extrasPosition, ...dataExtras } = extras || {};
      let position = extrasPosition;
      if (!position) {
        const stage = stageRef.current?.getBoundingClientRect();
        const center = screenToFlowPosition({
          x: (stage?.left ?? 0) + (stage?.width ?? 640) / 2,
          y: (stage?.top ?? 0) + (stage?.height ?? 480) / 2,
        });
        position = { x: center.x - 140, y: center.y - 120 };
      }
      const node = createBlankNode(kind, position, dataExtras);
      const next = { ...node, selected: true };
      setNodes((current) => current.map((item) => ({ ...item, selected: false })).concat(next));
      nodesRef.current = [...nodesRef.current.filter((item) => item.id !== next.id), next];
      if (dataExtras.prompt) {
        window.setTimeout(() => {
          void generateNode(next.id);
        }, 0);
      }
      return node.id;
    },
    [generateNode, screenToFlowPosition, setNodes],
  );

  const removeNode = useCallback(
    (id: string) => {
      setNodes((current) => current.filter((node) => node.id !== id));
      setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    },
    [setEdges, setNodes],
  );

  const removeNodes = useCallback(
    (ids: string[]) => {
      const drop = new Set(ids);
      setNodes((current) => current.filter((node) => !drop.has(node.id)));
      setEdges((current) => current.filter((edge) => !drop.has(edge.source) && !drop.has(edge.target)));
    },
    [setEdges, setNodes],
  );

  const duplicateNode = useCallback(
    (id: string) => {
      setNodes((current) => {
        const source = current.find((node) => node.id === id);
        if (!source) return current;
        const copy = createBlankNode(source.data.kind, {
          x: source.position.x + 40,
          y: source.position.y + 40,
        }, source.data);
        return current.map((node) => ({ ...node, selected: false })).concat({ ...copy, selected: true });
      });
    },
    [setNodes],
  );

  const duplicateNodes = useCallback(
    (ids: string[]) => {
      const pick = new Set(ids);
      setNodes((current) => {
        const copies = current
          .filter((node) => pick.has(node.id))
          .map((source) => ({
            ...createBlankNode(source.data.kind, {
              x: source.position.x + 40,
              y: source.position.y + 40,
            }, source.data),
            selected: true,
          }));
        return current.map((node) => ({ ...node, selected: false })).concat(copies);
      });
    },
    [setNodes],
  );

  const removeEdge = useCallback(
    (id: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== id));
    },
    [setEdges],
  );

  const bringToFront = useCallback(
    (id: string) => {
      setNodes((current) => {
        const index = current.findIndex((node) => node.id === id);
        if (index < 0 || index === current.length - 1) return current;
        const next = current.slice();
        const [node] = next.splice(index, 1);
        next.push(node);
        return next;
      });
    },
    [setNodes],
  );

  const sendToBack = useCallback(
    (id: string) => {
      setNodes((current) => {
        const index = current.findIndex((node) => node.id === id);
        if (index <= 0) return current;
        const next = current.slice();
        const [node] = next.splice(index, 1);
        next.unshift(node);
        return next;
      });
    },
    [setNodes],
  );

  const api = useMemo<StudioCanvasApi>(
    () => ({
      addNode,
      generateNode,
      removeNode,
      removeNodes,
      duplicateNode,
      duplicateNodes,
      removeEdge,
      bringToFront,
      sendToBack,
      updateNodeData,
      setNodeAspect,
      tool,
      setTool,
    }),
    [
      addNode,
      bringToFront,
      duplicateNode,
      duplicateNodes,
      generateNode,
      removeEdge,
      removeNode,
      removeNodes,
      sendToBack,
      setNodeAspect,
      tool,
      updateNodeData,
    ],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'v' || event.key === 'V') setTool('select');
      if (event.key === 'h' || event.key === 'H') setTool('pan');
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/studio/chat',
        body: () => ({
          canvas: nodes.map((node) => ({
            id: node.id,
            kind: node.data.kind,
            title: node.data.title,
            prompt: node.data.prompt,
            status: node.data.status,
          })),
        }),
      }),
    [nodes],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: project.id,
    transport,
    messages: project.messages,
    onFinish: ({ messages: next }) => {
      updateStudioGraph(project.id, { messages: next });
    },
  });

  useEffect(() => {
    applyProcessedTools(messages, seenTools.current, addNode);
  }, [addNode, messages]);

  const consumedPrompt = useRef(false);
  useEffect(() => {
    if (consumedPrompt.current || !project.pendingPrompt) return;
    consumedPrompt.current = true;
    updateStudioGraph(project.id, { pendingPrompt: undefined });
    const kind: StudioNodeKind = /视频|video|短片|分镜/i.test(project.pendingPrompt) ? 'video' : 'image';
    addNode(kind, { prompt: project.pendingPrompt, title: project.title });
    void sendMessage({ text: `请围绕这个创作意图展开，并在画布上继续：${project.pendingPrompt}` });
  }, [addNode, project.id, project.pendingPrompt, project.title, sendMessage]);

  return (
    <StudioCanvasProvider value={api}>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <StudioHeader
          title={title}
          onTitleChange={setTitle}
          agentOpen={agentOpen}
          onToggleAgent={() => setAgentOpen((open) => !open)}
        />
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 bg-[radial-gradient(760px_300px_at_18%_-12%,color-mix(in_srgb,var(--orange)_7%,transparent),transparent_58%),var(--cream)]" ref={stageRef}>
            <ReactFlow
              className={cn('h-full w-full', tool === 'pan' && 'cursor-grab [&_.react-flow__pane]:cursor-grab')}
              nodes={nodes}
              edges={[]}
              onNodesChange={onNodesChange}
              nodeTypes={studioNodeTypes}
              defaultViewport={project.viewport}
              proOptions={{ hideAttribution: true }}
              minZoom={0.2}
              maxZoom={2.4}
              deleteKeyCode={['Backspace', 'Delete']}
              nodesConnectable={false}
              elementsSelectable
              connectOnClick={false}
              panOnDrag={tool === 'pan' ? true : [1]}
              selectionOnDrag={tool === 'select'}
              nodesDraggable={tool === 'select'}
              onMoveEnd={(_, viewport) => persist({ viewport })}
              onPaneClick={() => {
                setMenu(null);
                setNodes((current) => current.map((node) => ({ ...node, selected: false })));
              }}
              onPaneContextMenu={(event) => {
                event.preventDefault();
                setMenu({
                  type: 'pane',
                  x: event.clientX,
                  y: event.clientY,
                  flow: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
                });
              }}
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                const selectedIds = nodesRef.current.filter((item) => item.selected).map((item) => item.id);
                if (selectedIds.length > 1 && selectedIds.includes(node.id)) {
                  setMenu({ type: 'selection', x: event.clientX, y: event.clientY, ids: selectedIds });
                  return;
                }
                setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })));
                setMenu({ type: 'node', x: event.clientX, y: event.clientY, nodeId: node.id });
              }}
              onSelectionContextMenu={(event, selected) => {
                event.preventDefault();
                const ids = selected.map((item) => item.id);
                if (ids.length > 1) {
                  setMenu({ type: 'selection', x: event.clientX, y: event.clientY, ids });
                }
              }}
            >
              <Background gap={22} size={1} color="var(--line)" />
              <Panel position="top-left" className="!m-0 h-full w-full pointer-events-none">
                <NodeOverlays stageRef={stageRef} />
              </Panel>
              <Panel position="center-left" className="z-[6] pointer-events-none !ml-3 [&_>_*]:pointer-events-auto">
                <LeftToolbar />
              </Panel>
              <Panel position="bottom-left" className="z-[6] pointer-events-none !m-3 [&_>_*]:pointer-events-auto">
                <ZoomControl />
              </Panel>
            </ReactFlow>
            <CanvasContextMenu menu={menu} onClose={() => setMenu(null)} />
          </div>
          <AgentPanel
            open={agentOpen}
            onClose={() => setAgentOpen(false)}
            messages={messages}
            status={status}
            error={error}
            onSend={(text) => {
              void sendMessage({ text });
            }}
            onStop={() => stop()}
          />
        </div>
      </div>
    </StudioCanvasProvider>
  );
}

export default function StudioWorkspace({ projectId }: StudioWorkspaceProps) {
  const router = useRouter();
  const [project, setProject] = useState<StudioProject | null | undefined>(undefined);

  useEffect(() => {
    setProject(getStudioProject(projectId));
  }, [projectId]);

  if (project === undefined) {
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">正在打开画布…</div>;
  }

  if (!project) {
    return (
      <div className="grid min-h-dvh place-items-center gap-3 text-muted-foreground">
        <p>找不到这个项目。</p>
        <button type="button" className="rounded-full bg-primary px-3.5 py-2 font-bold text-primary-foreground" onClick={() => router.push('/studio')}>
          返回 CreatorStudio
        </button>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasInner project={project} />
    </ReactFlowProvider>
  );
}
