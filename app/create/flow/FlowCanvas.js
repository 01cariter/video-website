'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';

import AgentDock from './AgentDock';
import CanvasChrome from './CanvasChrome';
import CanvasToolbar from './CanvasToolbar';
import ContextComposer from './ContextComposer';
import {
  appendHistory,
  createCanvasSnapshot,
  getIncomingRefs,
  getSelectedNode,
  persistCanvas,
  takeUndo,
} from './flow-state';
import { IMAGE_MODELS, QUICK_ACTIONS, VIDEO_MODELS } from './flow-options';
import { makeImageNode, makeSceneNode, nodeTypes } from './nodes';

function Flow({
  aiReady,
  initialEdges,
  initialKind,
  initialMessages,
  initialModel,
  initialNodes,
  initialPrompt,
  name,
  projectId,
}) {
  const { fitView, screenToFlowPosition } = useReactFlow();

  const seeded = useMemo(() => {
    if (initialNodes?.length) return initialNodes;

    if (initialKind === 'image') {
      return [makeImageNode({
        position: { x: 80, y: 120 },
        title: 'Image 1',
        prompt: initialPrompt || '',
        model: IMAGE_MODELS.some((item) => item.id === initialModel)
          ? initialModel
          : IMAGE_MODELS[0].id,
      })];
    }

    return [makeSceneNode({
      position: { x: 80, y: 120 },
      title: 'Scene 1',
      prompt: initialPrompt || '',
      model: VIDEO_MODELS.some((item) => item.id === initialModel)
        ? initialModel
        : VIDEO_MODELS[0].id,
    })];
  }, [initialKind, initialModel, initialNodes, initialPrompt]);

  const [nodes, setNodes, onNodesChange] = useNodesState(seeded);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);
  const [selectedId, setSelectedId] = useState(null);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [previousSelectedId, setPreviousSelectedId] = useState(null);
  const [messages, setMessages] = useState(initialMessages || []);
  const [chatInput, setChatInput] = useState('');
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentOpen, setAgentOpen] = useState(true);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [toolMode, setToolMode] = useState('select');
  const [saveState, setSaveState] = useState('idle');
  const [historyCount, setHistoryCount] = useState(0);

  const canvasName = name || '未命名项目';
  const selected = getSelectedNode(nodes, selectedId);
  const incomingRefs = useMemo(
    () => getIncomingRefs(nodes, edges, selectedId),
    [edges, nodes, selectedId],
  );

  if (selectedId !== previousSelectedId) {
    setPreviousSelectedId(selectedId);
    setDraftPrompt(selected?.data?.prompt || '');
  }

  const patch = useCallback(
    (id, data) => setNodes((items) => items.map((node) => (
      node.id === id ? { ...node, data: { ...node.data, ...data } } : node
    ))),
    [setNodes],
  );

  const historyRef = useRef([]);
  const recordHistory = useCallback(() => {
    historyRef.current = appendHistory(
      historyRef.current,
      createCanvasSnapshot(nodes, edges),
    );
    setHistoryCount(historyRef.current.length);
  }, [edges, nodes]);

  const undo = useCallback(() => {
    const result = takeUndo(historyRef.current);
    if (!result.previous) return;

    historyRef.current = result.history;
    setHistoryCount(result.history.length);
    setNodes(result.previous.nodes);
    setEdges(result.previous.edges);
    setSelectedId((id) => (
      result.previous.nodes.some((node) => node.id === id) ? id : null
    ));
  }, [setEdges, setNodes]);

  const saveTimerRef = useRef(null);
  const saveRequestRef = useRef(0);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    const requestId = saveRequestRef.current + 1;
    saveRequestRef.current = requestId;
    setSaveState('saving');

    saveTimerRef.current = setTimeout(async () => {
      try {
        await persistCanvas(fetch, { projectId, nodes, edges, name: canvasName });
        if (saveRequestRef.current === requestId) setSaveState('saved');
      } catch {
        if (saveRequestRef.current === requestId) setSaveState('error');
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [canvasName, edges, nodes, projectId]);

  const handleNodesChange = useCallback((changes) => {
    if (changes.some((change) => change.type === 'remove')) recordHistory();
    onNodesChange(changes);
  }, [onNodesChange, recordHistory]);

  const handleEdgesChange = useCallback((changes) => {
    if (changes.some((change) => change.type === 'remove')) recordHistory();
    onEdgesChange(changes);
  }, [onEdgesChange, recordHistory]);

  const handleConnect = useCallback((params) => {
    recordHistory();
    setEdges((items) => addEdge({ ...params, animated: true }, items));
  }, [recordHistory, setEdges]);

  const handleSelectionChange = useCallback(({ nodes: selectedNodes }) => {
    setSelectedId(selectedNodes?.[0]?.id || null);
  }, []);

  useEffect(() => {
    const withIncoming = new Set(edges.map((edge) => edge.target));
    setNodes((items) => items.map((node) => {
      const connected = withIncoming.has(node.id);
      if (node.data?.connected === connected) return node;
      return { ...node, data: { ...node.data, connected } };
    }));
  }, [edges, setNodes]);

  const addNode = useCallback((kind = 'video') => {
    recordHistory();

    const count = nodes.length + 1;
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 - (agentOpen ? 160 : 0),
      y: window.innerHeight / 2 - 100,
    });
    const node = kind === 'image'
      ? makeImageNode({ title: `Image ${count}`, position })
      : makeSceneNode({ title: `Scene ${count}`, position });
    const selectedNode = { ...node, selected: true };

    setNodes((items) => [
      ...items.map((item) => ({ ...item, selected: false })),
      selectedNode,
    ]);
    setSelectedId(node.id);
    setAddMenuOpen(false);
    setToolMode('select');
  }, [agentOpen, nodes.length, recordHistory, screenToFlowPosition, setNodes]);

  const organize = useCallback(() => {
    recordHistory();
    setNodes((items) => items.map((node, index) => ({
      ...node,
      position: {
        x: 80 + (index % 3) * 320,
        y: 80 + Math.floor(index / 3) * 300,
      },
    })));
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60);
  }, [fitView, recordHistory, setNodes]);

  const generate = useCallback(async (id, overrides = {}) => {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;

    const prompt = (overrides.prompt ?? node.data.prompt ?? '').trim();
    if (!prompt) return;

    const refs = getIncomingRefs(nodes, edges, id);
    const isImage = node.type === 'image';
    const config = isImage
      ? {
          kind: 'image',
          prompt,
          model: overrides.model ?? node.data.model,
          ratio: overrides.ratio ?? node.data.ratio,
          style: overrides.style ?? node.data.style,
          refs,
        }
      : {
          kind: 'video',
          prompt,
          model: overrides.model ?? node.data.model,
          mode: overrides.mode ?? node.data.mode,
          ratio: overrides.ratio ?? node.data.ratio,
          duration: overrides.duration ?? node.data.duration,
          refs,
        };

    patch(id, { ...config, status: 'running', caption: '', error: '' });

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || `生成请求失败 (${response.status})`);

      const result = json.result || {};
      patch(id, {
        status: 'done',
        poster: result.poster,
        caption: result.caption || '',
        error: '',
      });
    } catch (error) {
      patch(id, {
        status: 'error',
        error: error instanceof Error ? error.message : '生成失败',
      });
    }
  }, [edges, nodes, patch]);

  const submitDraft = useCallback((event) => {
    event?.preventDefault?.();
    if (!selected) return;
    generate(selected.id, { prompt: draftPrompt });
  }, [draftPrompt, generate, selected]);

  const canvasSummary = useMemo(() => {
    const titles = nodes.map((node) => node.data?.title).filter(Boolean).slice(0, 8);
    return `${nodes.length} nodes: ${titles.join(', ')}`;
  }, [nodes]);

  const runAgent = useCallback(async (action, input) => {
    if (action === 'organize') {
      organize();
      setMessages((items) => [
        ...items,
        { id: `local_${Date.now()}`, role: 'assistant', content: '已重新排版画布节点。' },
      ]);
      return;
    }

    const text = (input ?? chatInput).trim();
    if (!text && action === 'chat') return;

    setAgentBusy(true);
    if (text) {
      setMessages((items) => [
        ...items,
        { id: `u_${Date.now()}`, role: 'user', content: text },
      ]);
    }
    setChatInput('');

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action,
          input: text,
          context: { summary: canvasSummary },
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || `Agent 请求失败 (${response.status})`);
      if (json.message) setMessages((items) => [...items, json.message]);

      const spawned = json.styles || json.scenes;
      if (Array.isArray(spawned) && spawned.length) {
        recordHistory();
        const base = nodes.length;
        const created = spawned.map((scene, index) => makeSceneNode({
          title: scene.label || scene.title || `Shot ${base + index + 1}`,
          prompt: scene.prompt || '',
          duration: scene.duration || '5s',
          position: {
            x: 80 + ((base + index) % 3) * 320,
            y: 80 + Math.floor((base + index) / 3) * 300,
          },
        }));
        setNodes((items) => [...items, ...created]);
        setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80);
      }

      if (action === 'prompt' && json.message?.content && selected) {
        patch(selected.id, { prompt: json.message.content });
        setDraftPrompt(json.message.content);
      }
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: error instanceof Error ? error.message : '请求失败，请稍后再试。',
        },
      ]);
    } finally {
      setAgentBusy(false);
    }
  }, [
    canvasSummary,
    chatInput,
    fitView,
    nodes,
    organize,
    patch,
    projectId,
    recordHistory,
    selected,
    setNodes,
  ]);

  const runAgentAction = useCallback((action) => {
    runAgent(action, chatInput || draftPrompt || canvasName);
  }, [canvasName, chatInput, draftPrompt, runAgent]);

  const handleDraftChange = useCallback((value) => {
    if (!selected) return;
    setDraftPrompt(value);
    patch(selected.id, { prompt: value });
  }, [patch, selected]);

  const handleComposerPatch = useCallback((data) => {
    if (selected) patch(selected.id, data);
  }, [patch, selected]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  return (
    <div className={`flow-screen ${agentOpen ? 'flow-screen--agent-open' : ''}`}>
      <main className="flow-workspace">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onNodeDragStart={recordHistory}
          onConnect={handleConnect}
          onSelectionChange={handleSelectionChange}
          onPaneClick={() => setSelectedId(null)}
          nodeTypes={nodeTypes}
          panOnDrag={toolMode === 'pan'}
          selectionOnDrag={toolMode === 'select'}
          nodesDraggable={toolMode === 'select'}
          elementsSelectable={toolMode === 'select'}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ animated: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <MiniMap pannable zoomable nodeStrokeWidth={2} />
        </ReactFlow>

        <CanvasChrome
          agentOpen={agentOpen}
          aiReady={aiReady}
          canUndo={historyCount > 0}
          onFitView={handleFitView}
          onToggleAgent={() => setAgentOpen((open) => !open)}
          onUndo={undo}
          saveState={saveState}
        />

        <CanvasToolbar
          addMenuOpen={addMenuOpen}
          onAdd={addNode}
          onCloseAddMenu={() => setAddMenuOpen(false)}
          onFitView={handleFitView}
          onToggleAddMenu={() => setAddMenuOpen((open) => !open)}
          onToolChange={setToolMode}
          toolMode={toolMode}
        />

        <ContextComposer
          draftPrompt={draftPrompt}
          incomingRefs={incomingRefs}
          onDraftChange={handleDraftChange}
          onPatch={handleComposerPatch}
          onSubmit={submitDraft}
          selected={selected}
        />
      </main>

      <AgentDock
        aiReady={aiReady}
        busy={agentBusy}
        chatInput={chatInput}
        messages={messages}
        onChatInputChange={setChatInput}
        onClose={() => setAgentOpen(false)}
        onRunAction={runAgentAction}
        open={agentOpen}
        quickActions={QUICK_ACTIONS}
      />
    </div>
  );
}

export default function FlowCanvas(props) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
