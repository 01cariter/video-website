'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes, makeSceneNode } from './nodes';

const MODELS = [
  { id: 'runway-gen3', name: 'Runway Gen-3' },
  { id: 'luma-dream', name: 'Luma Dream Machine' },
  { id: 'kling-1.5', name: 'Kling 1.5' },
  { id: 'pika-2', name: 'Pika 2.0' },
  { id: 'sora', name: 'Sora' },
];
const RATIOS = ['16:9', '9:16', '1:1'];
const DURATIONS = ['5s', '10s'];
const MODES = ['文生视频', '首尾帧'];

const QUICK_ACTIONS = [
  { action: 'prompt', label: 'Prompt 生成', hint: '把想法改写成可用的生成提示词' },
  { action: 'brainstorm', label: '头脑风暴', hint: '给出多个创意方向' },
  { action: 'styles', label: '生成不同风格', hint: '产出 4 种风格变体节点' },
  { action: 'organize', label: '整理节点', hint: '自动排版画布' },
  { action: 'pipeline', label: '一句话 → 分镜', hint: '一句话到剧本到多分镜全流程' },
];

// ===========================================================================

function Flow({ projectId, name, initialNodes, initialEdges, initialMessages, initialPrompt, initialModel, aiReady }) {
  const { screenToFlowPosition, fitView } = useReactFlow();

  const seeded = useMemo(() => {
    if (initialNodes?.length) return initialNodes;
    // First visit: seed one node from the prompt passed by the studio.
    return [makeSceneNode({
      position: { x: 80, y: 120 },
      title: 'Scene 1',
      prompt: initialPrompt || '',
      model: MODELS.some((m) => m.id === initialModel) ? initialModel : MODELS[0].id,
    })];
  }, [initialNodes, initialPrompt, initialModel]);

  const [nodes, setNodes, onNodesChange] = useNodesState(seeded);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);
  const [selectedId, setSelectedId] = useState(seeded[0]?.id || null);
  const [canvasName, setCanvasName] = useState(name || '未命名项目');

  // bottom generation panel inputs (mirror the selected node)
  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) || null, [nodes, selectedId]);
  const [draftPrompt, setDraftPrompt] = useState(selected?.data?.prompt || '');

  // Sync the bottom-panel draft when the selection changes (adjust state during
  // render — React's recommended pattern instead of an effect).
  const [prevSel, setPrevSel] = useState(selectedId);
  if (selectedId !== prevSel) {
    setPrevSel(selectedId);
    setDraftPrompt(selected?.data?.prompt || '');
  }

  // agent panel
  const [messages, setMessages] = useState(initialMessages || []);
  const [chatInput, setChatInput] = useState('');
  const [agentBusy, setAgentBusy] = useState(false);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' });
  }, [messages]);

  const patch = useCallback(
    (id, data) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n))),
    [setNodes],
  );

  // ---- persistence (debounced autosave) ----------------------------------
  const saveTimer = useRef(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // strip transient callbacks; node data is plain JSON already
      fetch('/api/canvas', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, nodes, edges, name: canvasName }),
      }).catch(() => {});
    }, 800);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [nodes, edges, canvasName, projectId]);

  // ---- canvas interactions -----------------------------------------------
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  const onSelectionChange = useCallback(({ nodes: sel }) => {
    setSelectedId(sel?.[0]?.id || null);
  }, []);

  const addNode = useCallback(() => {
    const count = nodes.length + 1;
    const n = makeSceneNode({
      title: `Scene ${count}`,
      position: screenToFlowPosition({ x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 100 }),
    });
    setNodes((ns) => [...ns, n]);
    setSelectedId(n.id);
  }, [nodes.length, screenToFlowPosition, setNodes]);

  const organize = useCallback(() => {
    const COLS = 3;
    const W = 320;
    const H = 300;
    setNodes((ns) =>
      ns.map((n, i) => ({
        ...n,
        position: { x: 80 + (i % COLS) * W, y: 80 + Math.floor(i / COLS) * H },
      })),
    );
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60);
  }, [setNodes, fitView]);

  // ---- node generation ----------------------------------------------------
  const generate = useCallback(
    async (id, overrides = {}) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      const prompt = (overrides.prompt ?? node.data.prompt ?? '').trim();
      if (!prompt) return;

      const cfg = {
        prompt,
        model: overrides.model ?? node.data.model,
        mode: overrides.mode ?? node.data.mode,
        ratio: overrides.ratio ?? node.data.ratio,
        duration: overrides.duration ?? node.data.duration,
      };
      patch(id, { ...cfg, status: 'running', caption: '' });

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(cfg),
        });
        const json = await res.json();
        const r = json.result || {};
        patch(id, { status: 'done', poster: r.poster, caption: r.caption });
      } catch {
        patch(id, { status: 'done', caption: 'Generation failed — please retry.' });
      }
    },
    [nodes, patch],
  );

  const submitDraft = useCallback(
    (e) => {
      e?.preventDefault?.();
      if (!selected) return;
      generate(selected.id, { prompt: draftPrompt });
    },
    [selected, draftPrompt, generate],
  );

  // ---- agent --------------------------------------------------------------
  const canvasSummary = useMemo(() => {
    const titles = nodes.map((n) => n.data?.title).filter(Boolean).slice(0, 8);
    return `${nodes.length} nodes: ${titles.join(', ')}`;
  }, [nodes]);

  const runAgent = useCallback(
    async (action, input) => {
      if (action === 'organize') {
        organize();
        setMessages((m) => [...m, { id: `local_${Date.now()}`, role: 'assistant', content: '已重新排版画布节点。' }]);
        return;
      }
      const text = (input ?? chatInput).trim();
      if (!text && action === 'chat') return;
      setAgentBusy(true);
      if (text) setMessages((m) => [...m, { id: `u_${Date.now()}`, role: 'user', content: text }]);
      setChatInput('');

      try {
        const res = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId, action, input: text, context: { summary: canvasSummary } }),
        });
        const json = await res.json();
        if (json.message) setMessages((m) => [...m, json.message]);

        // styles → spawn one node per style; pipeline → one node per scene
        const spawn = json.styles || json.scenes;
        if (Array.isArray(spawn) && spawn.length) {
          const base = nodes.length;
          const created = spawn.map((s, i) =>
            makeSceneNode({
              title: s.label || s.title || `Shot ${base + i + 1}`,
              prompt: s.prompt || '',
              duration: s.duration || '5s',
              position: { x: 80 + ((base + i) % 3) * 320, y: 80 + Math.floor((base + i) / 3) * 300 },
            }),
          );
          setNodes((ns) => [...ns, ...created]);
          setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80);
        }

        // prompt action → write enhanced prompt into the selected node
        if (action === 'prompt' && json.message?.content && selected) {
          patch(selected.id, { prompt: json.message.content });
          setDraftPrompt(json.message.content);
        }
      } catch {
        setMessages((m) => [...m, { id: `e_${Date.now()}`, role: 'assistant', content: '请求失败，请稍后再试。' }]);
      } finally {
        setAgentBusy(false);
      }
    },
    [chatInput, projectId, canvasSummary, nodes, selected, organize, patch, setNodes, fitView],
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: true }}
        minZoom={0.2}
        maxZoom={1.8}
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
          <input
            className="flow-name-input"
            value={canvasName}
            onChange={(e) => setCanvasName(e.target.value)}
            spellCheck={false}
          />
          {!aiReady && <span className="flow-demo" title="未配置 AI Gateway，使用本地降级">demo</span>}
        </Panel>

        <Panel position="top-right" className="flow-tools">
          <button className="flow-add" onClick={addNode}>
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            添加节点
          </button>
        </Panel>
      </ReactFlow>

      {/* ---- bottom generation panel (figure 2) ---- */}
      {selected && (
        <form className="genbar" onSubmit={submitDraft}>
          <div className="genbar-top">
            <span className="genbar-label">{selected.data.title}</span>
            <div className="genbar-selects">
              <select
                value={selected.data.mode}
                onChange={(e) => patch(selected.id, { mode: e.target.value })}
              >
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                value={selected.data.model}
                onChange={(e) => patch(selected.id, { model: e.target.value })}
              >
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select
                value={selected.data.ratio}
                onChange={(e) => patch(selected.id, { ratio: e.target.value })}
              >
                {RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={selected.data.duration}
                onChange={(e) => patch(selected.id, { duration: e.target.value })}
              >
                {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="genbar-row">
            <textarea
              className="genbar-input"
              value={draftPrompt}
              onChange={(e) => {
                setDraftPrompt(e.target.value);
                patch(selected.id, { prompt: e.target.value });
              }}
              placeholder="描述这一镜的画面：主体、动作、镜头、光线、氛围…"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitDraft(e);
              }}
            />
            <button
              type="submit"
              className="genbar-go"
              disabled={selected.data.status === 'running' || !draftPrompt.trim()}
            >
              {selected.data.status === 'running' ? (
                <span className="scn-spin small" />
              ) : (
                <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              )}
              生成
            </button>
          </div>
        </form>
      )}

      {/* ---- right agent panel ---- */}
      <aside className="agent">
        <div className="agent-head">
          <span className="agent-dot" />
          <b>AI Agent</b>
          <small>{aiReady ? 'Vercel AI Gateway' : 'demo mode'}</small>
        </div>

        <div className="agent-actions">
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q.action}
              title={q.hint}
              disabled={agentBusy}
              onClick={() => runAgent(q.action, chatInput || draftPrompt || canvasName)}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="agent-log" ref={chatScrollRef}>
          {messages.length === 0 && (
            <div className="agent-empty">
              告诉我你的想法，我可以帮你润色 Prompt、头脑风暴、生成风格变体，或把一句话扩展成完整分镜并落到画布上。
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`agent-msg ${m.role}`}>
              {m.content}
            </div>
          ))}
          {agentBusy && (
            <div className="agent-msg assistant pending">
              <span className="scn-spin small" /> 思考中…
            </div>
          )}
        </div>

        <form
          className="agent-input"
          onSubmit={(e) => {
            e.preventDefault();
            runAgent('chat');
          }}
        >
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="和 Agent 对话…（一句话生成分镜、问问题、要灵感）"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                runAgent('chat');
              }
            }}
          />
          <button type="submit" disabled={agentBusy || !chatInput.trim()}>
            <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
      </aside>
    </>
  );
}

export default function FlowCanvas(props) {
  return (
    <div className="flow-screen has-agent">
      <ReactFlowProvider>
        <Flow {...props} />
      </ReactFlowProvider>
    </div>
  );
}
