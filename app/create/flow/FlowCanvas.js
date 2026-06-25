'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const MODELS = [
  { id: 'runway-gen3', name: 'Runway Gen-3', tag: 'Cinematic' },
  { id: 'luma-dream', name: 'Luma Dream Machine', tag: 'Fast' },
  { id: 'kling-1.5', name: 'Kling 1.5', tag: 'Realistic' },
  { id: 'pika-2', name: 'Pika 2.0', tag: 'Stylized' },
  { id: 'sora', name: 'Sora', tag: 'High-fidelity' },
];

// ---------------------------------------------------------------------------
// Custom nodes
// ---------------------------------------------------------------------------

function NodeShell({ kind, title, children }) {
  return (
    <div className={`flnode flode-${kind}`}>
      <div className="flode-head">
        <span className={`flode-icon ${kind}`}>{ICONS[kind]}</span>
        <span className="flode-title">{title}</span>
      </div>
      <div className="flode-body">{children}</div>
    </div>
  );
}

function PromptNode({ data }) {
  return (
    <NodeShell kind="prompt" title="Prompt">
      <textarea
        className="flode-ta"
        value={data.prompt}
        onChange={(e) => data.onPrompt?.(e.target.value)}
        placeholder="Describe your short…"
        rows={4}
      />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

function ModelNode({ data }) {
  return (
    <NodeShell kind="model" title="AI model">
      <select className="flode-select" value={data.model} onChange={(e) => data.onModel?.(e.target.value)}>
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} · {m.tag}
          </option>
        ))}
      </select>
      <div className="flode-meta">Diffusion · text-to-video</div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

function GenerateNode({ data }) {
  const { status } = data;
  return (
    <NodeShell kind="generate" title="Generate">
      <div className={`flode-status ${status}`}>
        <span className="dot" />
        {status === 'running' ? 'Generating…' : status === 'done' ? 'Completed' : 'Ready'}
      </div>
      <button className="flode-run" onClick={data.onRun} disabled={status === 'running'}>
        {status === 'running' ? 'Working…' : status === 'done' ? 'Run again' : 'Run workflow'}
      </button>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

function OutputNode({ data }) {
  const { status, takes } = data;
  return (
    <NodeShell kind="output" title="Output">
      <div className="flode-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`flode-cell ${status === 'running' ? 'skel' : ''}`}>
            {status === 'done' && takes?.[i] ? (
              <img src={takes[i]} alt={`Take ${i + 1}`} />
            ) : status === 'running' ? null : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        ))}
      </div>
      <Handle type="target" position={Position.Left} />
    </NodeShell>
  );
}

const ICONS = {
  prompt: (
    <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h7" /></svg>
  ),
  model: (
    <svg viewBox="0 0 24 24"><path d="M12 3l2.1 4.8L19 9l-3.6 3.3L16.4 18 12 15.4 7.6 18l1-5.7L5 9l4.9-1.2Z" /></svg>
  ),
  generate: (
    <svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
  ),
  output: (
    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M10 9l5 3-5 3z" /></svg>
  ),
};

const RESULT_POOL = [
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=500&q=70',
];

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

function Flow({ prompt: initialPrompt, model: initialModel }) {
  const nodeTypes = useMemo(
    () => ({ prompt: PromptNode, model: ModelNode, generate: GenerateNode, output: OutputNode }),
    [],
  );

  const startModel = MODELS.some((m) => m.id === initialModel) ? initialModel : MODELS[0].id;

  const [nodes, setNodes, onNodesChange] = useNodesState([
    {
      id: 'prompt',
      type: 'prompt',
      position: { x: 0, y: 80 },
      data: { prompt: initialPrompt || '' },
    },
    {
      id: 'model',
      type: 'model',
      position: { x: 320, y: 96 },
      data: { model: startModel },
    },
    {
      id: 'generate',
      type: 'generate',
      position: { x: 640, y: 110 },
      data: { status: 'idle' },
    },
    {
      id: 'output',
      type: 'output',
      position: { x: 940, y: 60 },
      data: { status: 'idle', takes: [] },
    },
  ]);

  const [edges, setEdges, onEdgesChange] = useEdgesState([
    { id: 'e1', source: 'prompt', target: 'model', animated: true },
    { id: 'e2', source: 'model', target: 'generate', animated: true },
    { id: 'e3', source: 'generate', target: 'output', animated: true },
  ]);

  const patch = useCallback(
    (id, data) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n))),
    [setNodes],
  );

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)), [setEdges]);

  const run = useCallback(() => {
    patch('generate', { status: 'running' });
    patch('output', { status: 'running', takes: [] });
    setTimeout(() => {
      const takes = [...RESULT_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
      patch('generate', { status: 'done' });
      patch('output', { status: 'done', takes });
    }, 1600);
  }, [patch]);

  // Inject live callbacks into node data (kept out of state to avoid loops).
  const nodesWithHandlers = useMemo(
    () =>
      nodes.map((n) => {
        if (n.id === 'prompt') return { ...n, data: { ...n.data, onPrompt: (v) => patch('prompt', { prompt: v }) } };
        if (n.id === 'model') return { ...n, data: { ...n.data, onModel: (v) => patch('model', { model: v }) } };
        if (n.id === 'generate') return { ...n, data: { ...n.data, onRun: run } };
        return n;
      }),
    [nodes, patch, run],
  );

  return (
    <ReactFlow
      nodes={nodesWithHandlers}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ animated: true }}
      minZoom={0.3}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeStrokeWidth={3} />
      <Panel position="top-left" className="flow-panel">
        <Link className="flow-back" href="/create">
          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
          Studio
        </Link>
        <span className="flow-divider" />
        <span className="flow-name">AI workflow</span>
      </Panel>
    </ReactFlow>
  );
}

export default function FlowCanvas({ prompt, model }) {
  const [mounted] = useState(true); // ensures client-only render
  return (
    <div className="flow-screen">
      {mounted && (
        <ReactFlowProvider>
          <Flow prompt={prompt} model={model} />
        </ReactFlowProvider>
      )}
    </div>
  );
}
