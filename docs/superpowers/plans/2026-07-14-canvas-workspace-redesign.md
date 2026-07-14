# Canvas Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/create/flow` as the approved option 1 dark canvas workspace while preserving the existing generation, connection, Agent, loading, and persistence contracts.

**Architecture:** Keep React Flow node/edge ownership and all network orchestration in `FlowCanvas.js`, but extract pure state helpers and focused presentation components. Render the canvas and Agent as a responsive two-column shell, place chrome and the selected-node composer over the canvas, and keep session undo in a bounded in-memory snapshot history.

**Tech Stack:** Next.js 16 App Router, React 19, `@xyflow/react` 12, Lucide React icons, CSS, Node's built-in test runner.

## Global Constraints

- Target only `/create/flow`; do not add or change routes.
- Keep `/api/canvas`, `/api/generate`, and `/api/agent` request/response contracts unchanged.
- Preserve the existing `--orange` and `--orange-d` accents on a near-black canvas.
- Remove `Studio`, the editable `未命名项目` field, both connection instruction sentences, the `添加节点` text label, and the empty selection instruction.
- Show only controls that work: back, undo, save state, fit view, Agent toggle, add, select, and pan.
- Do not add gradients, glassmorphism, glows, decorative pills, nested cards, billing/community controls, or new backend state.
- The contextual composer is hidden without a selected node and edits only the selected node.
- The Agent uses a reserved `320px` desktop column and an overlay drawer below `1100px`.
- Use accessible names, tooltips, focus states, and reduced-motion handling for icon-only controls.
- Use the approved visual target at `docs/superpowers/specs/assets/2026-07-14-canvas-workspace-option-1.png` for visual comparison.

## File Map

- Create `app/create/flow/flow-state.js`: selected-node/reference derivation, canvas snapshots, bounded undo, and persistence request helper.
- Create `test/flow-state.test.js`: regression tests for selection, references, undo isolation/limits, and save success/failure.
- Create `app/create/flow/flow-options.js`: video/image model, ratio, mode, duration, style, and Agent action constants.
- Create `app/create/flow/MediaNodeFrame.js`: one media-first visual frame shared by scene and image nodes.
- Modify `app/create/flow/nodes.js`: factories remain; node renderers delegate to `MediaNodeFrame`.
- Create `app/create/flow/CanvasChrome.js`: back, undo, save indicator, fit-view, and Agent toggle.
- Create `app/create/flow/CanvasToolbar.js`: functional add menu plus select and pan modes.
- Create `app/create/flow/ContextComposer.js`: selected-node prompt, parameters, references, errors, and submit.
- Create `app/create/flow/AgentDock.js`: existing quick actions, messages, busy state, input, and collapse action.
- Modify `app/create/flow/FlowCanvas.js`: integrate extracted components, history, save states, responsive Agent state, and existing APIs.
- Create `app/create/flow/flow.css`: complete workspace, node, composer, Agent, responsive, focus, and reduced-motion styling.
- Modify `app/create/flow/page.js`: import the route-scoped canvas stylesheet.
- Modify `app/globals.css`: delete the superseded `/create/flow` block.
- Modify `package.json` and `package-lock.json`: add `lucide-react` as the single icon library.

---

### Task 1: Add Pure Flow State and Persistence Helpers

**Files:**
- Create: `app/create/flow/flow-state.js`
- Create: `test/flow-state.test.js`

**Interfaces:**
- Produces: `getSelectedNode(nodes, selectedId) -> node | null`.
- Produces: `getIncomingRefs(nodes, edges, selectedId) -> Array<{ id, poster, prompt, title }>`.
- Produces: `createCanvasSnapshot(nodes, edges) -> { nodes, edges }` with isolated node data/position objects.
- Produces: `appendHistory(history, snapshot, limit?) -> snapshot[]` capped at `50` by default.
- Produces: `takeUndo(history) -> { previous, history }`.
- Produces: `persistCanvas(fetcher, payload) -> Promise<'saved'>`, rejecting on network and non-2xx responses.

- [ ] **Step 1: Write failing helper tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendHistory,
  createCanvasSnapshot,
  getIncomingRefs,
  getSelectedNode,
  persistCanvas,
  takeUndo,
} from '../app/create/flow/flow-state.js';

const nodes = [
  { id: 'a', position: { x: 1, y: 2 }, data: { title: 'Source', prompt: 'first', poster: '/a.jpg' } },
  { id: 'b', position: { x: 3, y: 4 }, data: { title: 'Target', prompt: 'second' } },
];
const edges = [{ id: 'a-b', source: 'a', target: 'b' }];

test('derives the selected node without assuming nodes is always populated', () => {
  assert.equal(getSelectedNode(nodes, 'b')?.id, 'b');
  assert.equal(getSelectedNode([], 'b'), null);
  assert.equal(getSelectedNode(nodes, null), null);
});

test('derives compact incoming references from source nodes', () => {
  assert.deepEqual(getIncomingRefs(nodes, edges, 'b'), [
    { id: 'a', poster: '/a.jpg', prompt: 'first', title: 'Source' },
  ]);
  assert.deepEqual(getIncomingRefs(nodes, edges, 'a'), []);
});

test('creates isolated snapshots and caps history', () => {
  const snapshot = createCanvasSnapshot(nodes, edges);
  nodes[0].data.title = 'Changed after snapshot';
  assert.equal(snapshot.nodes[0].data.title, 'Source');

  const history = [1, 2, 3].reduce(
    (items, value) => appendHistory(items, { nodes: [{ id: String(value) }], edges: [] }, 2),
    [],
  );
  assert.deepEqual(history.map((item) => item.nodes[0].id), ['2', '3']);
});

test('consumes the newest undo snapshot', () => {
  const first = { nodes: [{ id: 'first' }], edges: [] };
  const second = { nodes: [{ id: 'second' }], edges: [] };
  assert.deepEqual(takeUndo([first, second]), { previous: second, history: [first] });
  assert.deepEqual(takeUndo([]), { previous: null, history: [] });
});

test('reports save success and rejects failed responses', async () => {
  const calls = [];
  const okFetch = async (...args) => {
    calls.push(args);
    return { ok: true };
  };
  assert.equal(await persistCanvas(okFetch, { projectId: 2, nodes: [], edges: [], name: 'Canvas' }), 'saved');
  assert.equal(calls[0][0], '/api/canvas');
  assert.equal(calls[0][1].method, 'PUT');

  await assert.rejects(
    persistCanvas(async () => ({ ok: false, status: 500 }), { projectId: 2, nodes: [], edges: [] }),
    /Canvas save failed: 500/,
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --experimental-default-type=module --test test/flow-state.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `flow-state.js`.

- [ ] **Step 3: Implement the helpers**

```js
const DEFAULT_HISTORY_LIMIT = 50;

export function getSelectedNode(nodes, selectedId) {
  if (!selectedId || !Array.isArray(nodes)) return null;
  return nodes.find((node) => node.id === selectedId) || null;
}

export function getIncomingRefs(nodes, edges, selectedId) {
  if (!selectedId || !Array.isArray(nodes) || !Array.isArray(edges)) return [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges
    .filter((edge) => edge.target === selectedId)
    .map((edge) => byId.get(edge.source))
    .filter(Boolean)
    .map((node) => ({
      id: node.id,
      poster: node.data?.poster || null,
      prompt: node.data?.prompt || '',
      title: node.data?.title || node.id,
    }));
}

export function createCanvasSnapshot(nodes, edges) {
  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: { ...node.data },
    })),
    edges: edges.map((edge) => ({ ...edge })),
  };
}

export function appendHistory(history, snapshot, limit = DEFAULT_HISTORY_LIMIT) {
  return [...history, snapshot].slice(-limit);
}

export function takeUndo(history) {
  if (!history.length) return { previous: null, history: [] };
  return { previous: history[history.length - 1], history: history.slice(0, -1) };
}

export async function persistCanvas(fetcher, payload) {
  const response = await fetcher('/api/canvas', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Canvas save failed: ${response.status}`);
  return 'saved';
}
```

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: 9 tests pass, including the existing legacy JSONB normalization tests.

- [ ] **Step 5: Commit**

```bash
git add app/create/flow/flow-state.js test/flow-state.test.js
git commit -m "test(flow): cover selection references undo and saving"
```

---

### Task 2: Add the Shared Options and Media-First Node Frame

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `app/create/flow/flow-options.js`
- Create: `app/create/flow/MediaNodeFrame.js`
- Modify: `app/create/flow/nodes.js`

**Interfaces:**
- Produces: named option arrays `VIDEO_MODELS`, `IMAGE_MODELS`, `RATIOS`, `DURATIONS`, `VIDEO_MODES`, `IMAGE_STYLES`, and `QUICK_ACTIONS`.
- Produces: `MediaNodeFrame({ kind, data })`, used by both React Flow node types.
- Preserves: `nodeTypes`, `makeSceneNode`, and `makeImageNode` exports and their current data defaults.

- [ ] **Step 1: Install the single icon library**

Run: `npm install lucide-react`

Expected: `lucide-react` is added to dependencies and the lockfile is updated without peer-dependency errors.

- [ ] **Step 2: Move option constants into `flow-options.js`**

Create named exports with the exact IDs and labels currently defined in `FlowCanvas.js`. Keep the current five video models, three image models, three ratios, two durations, two video modes, seven image styles, and five Agent quick actions. Rename only `MODELS` to `VIDEO_MODELS` and `MODES` to `VIDEO_MODES` so component props remain unambiguous.

```js
export const VIDEO_MODELS = [
  { id: 'runway-gen3', name: 'Runway Gen-3' },
  { id: 'luma-dream', name: 'Luma Dream Machine' },
  { id: 'kling-1.5', name: 'Kling 1.5' },
  { id: 'pika-2', name: 'Pika 2.0' },
  { id: 'sora', name: 'Sora' },
];

export const IMAGE_MODELS = [
  { id: 'imagen-4-fast', name: 'Imagen 4 Fast' },
  { id: 'flux-pro', name: 'FLUX Pro' },
  { id: 'seedream', name: 'Seedream' },
];

export const RATIOS = ['16:9', '9:16', '1:1'];
export const DURATIONS = ['5s', '10s'];
export const VIDEO_MODES = ['文生视频', '首尾帧'];
```

- [ ] **Step 3: Create `MediaNodeFrame`**

Use Lucide's `ImageIcon`, `Video`, `Play`, `Link2`, `LoaderCircle`, and `TriangleAlert`. Compute the aspect ratio from `data.ratio`; display generated media when `status === 'done'`; display an inline spinner while running; display a compact error row for `status === 'error'`; otherwise display only the media-type icon. Keep the title above the media, use a small continuity icon when `data.connected`, show duration only for video, and show no instructional fallback sentence.

```jsx
export default function MediaNodeFrame({ kind, data }) {
  const isImage = kind === 'image';
  const status = data.status || 'idle';
  const ratio = data.ratio || (isImage ? '1:1' : '16:9');
  const aspectRatio = ratio === '9:16' ? '9 / 16' : ratio === '1:1' ? '1 / 1' : '16 / 9';
  const EmptyIcon = isImage ? ImageIcon : Video;

  return (
    <div className={`media-node media-node--${kind} media-node--${status}`}>
      <Handle type="target" position={Position.Left} />
      <div className="media-node__label">
        <span>{data.title || (isImage ? 'Image' : 'Scene')}</span>
        {data.connected && <Link2 aria-label="已连接参考节点" size={13} />}
      </div>
      <div className="media-node__surface" style={{ aspectRatio }}>
        {status === 'done' && data.poster ? <img src={data.poster} alt={data.title || 'Generated media'} draggable={false} /> : null}
        {status === 'done' && !isImage && data.poster ? <span className="media-node__play"><Play size={18} fill="currentColor" /></span> : null}
        {status === 'done' && !isImage ? <span className="media-node__duration">{data.duration || '5s'}</span> : null}
        {status === 'running' ? <span className="media-node__state"><LoaderCircle className="is-spinning" /><small>生成中</small></span> : null}
        {status === 'error' ? <span className="media-node__state media-node__state--error"><TriangleAlert /><small>{data.error || '生成失败'}</small></span> : null}
        {status === 'idle' ? <EmptyIcon className="media-node__empty-icon" /> : null}
      </div>
      {data.caption || data.prompt ? <p className="media-node__caption">{data.caption || data.prompt}</p> : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 4: Delegate both node types to the shared frame**

Keep `Handle` logic inside `MediaNodeFrame`; make `SceneNode` return `<MediaNodeFrame kind="video" data={data} />` and `ImageNode` return `<MediaNodeFrame kind="image" data={data} />`. Do not change either node factory's IDs or persisted data shape.

- [ ] **Step 5: Verify code quality**

Run: `npm run lint && npm run build`

Expected: build succeeds; an existing `no-img-element` warning is acceptable until final verification, but there are no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app/create/flow/flow-options.js app/create/flow/MediaNodeFrame.js app/create/flow/nodes.js
git commit -m "refactor(flow): unify media node presentation"
```

---

### Task 3: Build Functional Canvas Chrome and Toolbar

**Files:**
- Create: `app/create/flow/CanvasChrome.js`
- Create: `app/create/flow/CanvasToolbar.js`

**Interfaces:**
- `CanvasChrome({ agentOpen, aiReady, canUndo, onUndo, onFitView, onToggleAgent, saveState })`.
- `CanvasToolbar({ addMenuOpen, onAdd, onCloseAddMenu, onToggleAddMenu, onFitView, onToolChange, toolMode })`.
- `toolMode` is exactly `'select' | 'pan'`.

- [ ] **Step 1: Create the top chrome**

Use Lucide `ArrowLeft`, `Undo2`, `Maximize2`, `PanelRightClose`, and `PanelRightOpen`. Back is a `Link` to `/create`. Every control receives an `aria-label` and matching `title`. Disable undo when `canUndo` is false. Render the save indicator with `role="status"`, `aria-live="polite"`, a `data-state` attribute, and one of `保存中`, `已保存`, or `保存失败`; keep the label visually hidden while the dot/icon remains visible. Show a small `demo` indicator only when `aiReady` is false.

- [ ] **Step 2: Create the left toolbar**

Use Lucide `Plus`, `MousePointer2`, `Hand`, `Maximize2`, `Video`, and `ImageIcon`. The plus button toggles a two-item image/video menu; selecting an item calls `onAdd('image')` or `onAdd('video')` and closes the menu. Select and pan buttons expose `aria-pressed`. Fit view calls `onFitView`. Close the menu on Escape and outside pointer down through a local ref/effect.

```jsx
<nav className="canvas-toolbar" aria-label="画布工具">
  <div className="canvas-toolbar__add">
    <button type="button" aria-label="添加节点" title="添加节点" onClick={onToggleAddMenu}><Plus /></button>
    {addMenuOpen ? (
      <div className="canvas-add-menu" role="menu">
        <button type="button" role="menuitem" onClick={() => onAdd('video')}><Video /><span><b>视频场景</b><small>文生视频 / 关键帧</small></span></button>
        <button type="button" role="menuitem" onClick={() => onAdd('image')}><ImageIcon /><span><b>图片生成</b><small>文生图</small></span></button>
      </div>
    ) : null}
  </div>
  <span className="canvas-toolbar__divider" />
  <button type="button" aria-label="选择工具" title="选择工具" aria-pressed={toolMode === 'select'} onClick={() => onToolChange('select')}><MousePointer2 /></button>
  <button type="button" aria-label="平移画布" title="平移画布" aria-pressed={toolMode === 'pan'} onClick={() => onToolChange('pan')}><Hand /></button>
  <button type="button" aria-label="适配画布" title="适配画布" onClick={onFitView}><Maximize2 /></button>
</nav>
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: no React hook, accessibility, or JSX errors in either new component.

- [ ] **Step 4: Commit**

```bash
git add app/create/flow/CanvasChrome.js app/create/flow/CanvasToolbar.js
git commit -m "feat(flow): add canvas chrome and tools"
```

---

### Task 4: Build the Selected-Node Context Composer

**Files:**
- Create: `app/create/flow/ContextComposer.js`

**Interfaces:**
- Consumes option arrays from `flow-options.js`.
- `ContextComposer({ draftPrompt, incomingRefs, onDraftChange, onPatch, onSubmit, selected })`.
- `onPatch(data)` patches only `selected.id`; `onSubmit(event)` runs existing generation.

- [ ] **Step 1: Implement the selected-only form**

Return `null` when `selected` is absent. Use Lucide `ImageIcon`, `Video`, `Link2`, `ArrowUp`, and `LoaderCircle`. Render thumbnail/title reference chips before the prompt only when `incomingRefs.length > 0`. For image nodes render style/model/ratio selects; for video nodes render mode/model/ratio/duration selects. Render a compact inline error with `role="alert"` from `selected.data.error`. Keep `Cmd/Ctrl + Enter` submission.

```jsx
export default function ContextComposer({ draftPrompt, incomingRefs, onDraftChange, onPatch, onSubmit, selected }) {
  if (!selected) return null;
  const isImage = selected.type === 'image';
  const running = selected.data.status === 'running';
  const KindIcon = isImage ? ImageIcon : Video;

  return (
    <form className="context-composer" onSubmit={onSubmit} aria-label={`${selected.data.title || '节点'}生成设置`}>
      <div className="context-composer__identity"><KindIcon /><span>{selected.data.title}</span></div>
      {incomingRefs.length ? (
        <div className="context-composer__refs" aria-label="参考节点">
          <Link2 aria-hidden="true" />
          {incomingRefs.map((ref) => <span className="reference-chip" key={ref.id}>{ref.poster ? <img src={ref.poster} alt="" /> : null}<span>{ref.title}</span></span>)}
        </div>
      ) : null}
      <textarea value={draftPrompt} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSubmit(event); }} placeholder={isImage ? '描述要生成的图片…' : '描述这一镜的画面…'} rows={3} />
      {selected.data.error ? <p className="context-composer__error" role="alert">{selected.data.error}，修改提示词或直接重试。</p> : null}
      <div className="context-composer__footer">
        <div className="context-composer__params">
          {isImage ? (
            <>
              <select aria-label="图片风格" value={selected.data.style} onChange={(event) => onPatch({ style: event.target.value })}>
                {IMAGE_STYLES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select aria-label="图片模型" value={selected.data.model} onChange={(event) => onPatch({ model: event.target.value })}>
                {IMAGE_MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select aria-label="图片比例" value={selected.data.ratio} onChange={(event) => onPatch({ ratio: event.target.value })}>
                {RATIOS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </>
          ) : (
            <>
              <select aria-label="视频模式" value={selected.data.mode} onChange={(event) => onPatch({ mode: event.target.value })}>
                {VIDEO_MODES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select aria-label="视频模型" value={selected.data.model} onChange={(event) => onPatch({ model: event.target.value })}>
                {VIDEO_MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select aria-label="视频比例" value={selected.data.ratio} onChange={(event) => onPatch({ ratio: event.target.value })}>
                {RATIOS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select aria-label="视频时长" value={selected.data.duration} onChange={(event) => onPatch({ duration: event.target.value })}>
                {DURATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </>
          )}
        </div>
        <button type="submit" aria-label={running ? '正在生成' : '生成'} title={running ? '正在生成' : '生成'} disabled={running || !draftPrompt.trim()}>{running ? <LoaderCircle className="is-spinning" /> : <ArrowUp />}</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: no errors; the component has no internal copy of node state.

- [ ] **Step 3: Commit**

```bash
git add app/create/flow/ContextComposer.js
git commit -m "feat(flow): add contextual generation composer"
```

---

### Task 5: Extract the Collapsible Agent Dock

**Files:**
- Create: `app/create/flow/AgentDock.js`

**Interfaces:**
- `AgentDock({ aiReady, busy, chatInput, messages, onChatInputChange, onClose, onRunAction, open, quickActions })`.
- Does not own or reset messages when collapsed.

- [ ] **Step 1: Implement the dock**

Return `null` only when `open` is false. Use Lucide `Bot`, `X`, `Send`, and `LoaderCircle`. Render the existing five quick actions as compact buttons, preserve current titles from `hint`, render messages with the current user/assistant distinction, scroll the log to the last message on message/busy changes, keep the input pinned at the bottom, submit on Enter without Shift, and show the existing demo/provider state without promotional cards.

```jsx
<aside className="agent-dock" aria-label="AI Agent">
  <header className="agent-dock__header">
    <Bot aria-hidden="true" />
    <b>AI Agent</b>
    <small>{aiReady ? 'AI Gateway' : 'demo'}</small>
    <button type="button" aria-label="关闭 Agent" title="关闭 Agent" onClick={onClose}><X /></button>
  </header>
  <div className="agent-dock__actions">
    {quickActions.map((item) => <button key={item.action} type="button" title={item.hint} disabled={busy} onClick={() => onRunAction(item.action)}>{item.label}</button>)}
  </div>
  <div className="agent-dock__log" ref={logRef}>
    {messages.map((message) => <div key={message.id} className={`agent-message agent-message--${message.role}`}>{message.content}</div>)}
    {busy ? <div className="agent-message agent-message--assistant"><LoaderCircle className="is-spinning" />思考中…</div> : null}
  </div>
  <form className="agent-dock__composer" onSubmit={handleSubmit}>
    <textarea value={chatInput} onChange={(event) => onChatInputChange(event.target.value)} onKeyDown={handleKeyDown} placeholder="描述创意或向 Agent 提问" rows={2} />
    <button type="submit" aria-label="发送消息" title="发送消息" disabled={busy || !chatInput.trim()}><Send /></button>
  </form>
</aside>
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: no hook dependency or accessibility errors.

- [ ] **Step 3: Commit**

```bash
git add app/create/flow/AgentDock.js
git commit -m "refactor(flow): extract collapsible agent dock"
```

---

### Task 6: Integrate Components, Undo, Save State, and Error Preservation

**Files:**
- Modify: `app/create/flow/FlowCanvas.js`

**Interfaces:**
- Consumes every component/helper created in Tasks 1–5.
- Preserves the current `FlowCanvas(props)` public interface from `page.js`.
- Preserves existing `/api/generate` and `/api/agent` payloads.

- [ ] **Step 1: Replace derived state with tested helpers**

Import `getSelectedNode` and `getIncomingRefs`; remove inline `.find` and edge mapping. Initialize `selectedId` to `null`, so the composer is hidden until React Flow selects a node. Keep the render-time draft synchronization pattern so selection changes update `draftPrompt` without a set-state effect.

- [ ] **Step 2: Add bounded session undo**

Create `historyRef = useRef([])` and `recordHistory()` using `appendHistory(historyRef.current, createCanvasSnapshot(nodes, edges))`. Record once before add, connect, organize, delete, and drag. Use `onNodeDragStart={recordHistory}`. Wrap `onNodesChange` and `onEdgesChange` to record before `remove` changes, but do not record `select` or intermediate position frames. Implement `undo()` with `takeUndo`, then restore both arrays and clear a selected ID that no longer exists.

```js
const undo = useCallback(() => {
  const result = takeUndo(historyRef.current);
  if (!result.previous) return;
  historyRef.current = result.history;
  setNodes(result.previous.nodes);
  setEdges(result.previous.edges);
  setSelectedId((id) => result.previous.nodes.some((node) => node.id === id) ? id : null);
}, [setEdges, setNodes]);
```

- [ ] **Step 3: Expose real save state**

Replace the swallowed fetch with `persistCanvas(fetch, payload)`. Set `saveState` to `saving` as soon as a debounced save is scheduled, set it to `saved` only for the newest successful request, and set it to `error` for the newest failed request. Keep the `800ms` debounce and preserve the unchanged name value from the server without rendering an editor.

- [ ] **Step 4: Preserve generation errors and validate HTTP responses**

Before reading the result, check `res.ok`; throw the API error string when present. Patch `{ status: 'error', error: message }` on failure instead of pretending the node is done. Clear `error` when retrying and when a generation succeeds. Keep the existing `refs`, kind-specific payload fields, generated poster, and caption behavior.

- [ ] **Step 5: Integrate the workspace shell**

Render one `flow-screen` grid with `flow-workspace` and conditional `AgentDock`. Place `CanvasChrome`, `CanvasToolbar`, and `ContextComposer` as siblings over the React Flow surface. Remove the old `Panel`, `Controls`, inline generation bar, fixed Agent markup, project-name input, and all six removed strings. Keep `Background` and `MiniMap`. Wire `toolMode` to `panOnDrag`, `selectionOnDrag`, and `nodesDraggable`; add a visible selected state when `addNode` creates and selects a new node.

```jsx
<div className={`flow-screen ${agentOpen ? 'flow-screen--agent-open' : ''}`}>
  <main className="flow-workspace">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onNodeDragStart={recordHistory}
      onConnect={handleConnect}
      onSelectionChange={onSelectionChange}
      nodeTypes={nodeTypes}
      panOnDrag={toolMode === 'pan'}
      selectionOnDrag={toolMode === 'select'}
      nodesDraggable={toolMode === 'select'}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.2}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
      <MiniMap pannable zoomable nodeStrokeWidth={2} />
    </ReactFlow>
    <CanvasChrome />
    <CanvasToolbar />
    <ContextComposer />
  </main>
  <AgentDock />
</div>
```

- [ ] **Step 6: Verify removed copy and behavior contracts**

Run: `rg -n "Studio|未命名项目|拖动节点右侧圆点连线|添加节点</|选择一个节点开始编辑|提示：把节点右侧连线" app/create/flow`

Expected: no matches in rendered JSX; the internal fallback name may remain only as an unrendered persistence value if required.

Run: `npm test && npm run lint && npm run build`

Expected: all tests and build pass; no new lint errors.

- [ ] **Step 7: Commit**

```bash
git add app/create/flow/FlowCanvas.js
git commit -m "feat(flow): integrate focused canvas workspace"
```

---

### Task 7: Apply the Approved Visual System and Responsive Layout

**Files:**
- Create: `app/create/flow/flow.css`
- Modify: `app/create/flow/page.js`
- Modify: `app/globals.css`

**Interfaces:**
- Styles only the class names introduced in Tasks 2–6 and scoped React Flow descendants under `.flow-screen`.
- Does not change global product tokens or non-flow routes.

- [ ] **Step 1: Import route-scoped CSS and remove obsolete global rules**

Add `import './flow.css';` after the XYFlow stylesheet import in `page.js`. Delete the old block from `/* ---- AI workflow canvas (/create/flow) ---- */` through the end of `.agent-input button svg`; do not alter feed/player/create styles around it.

- [ ] **Step 2: Implement the desktop workspace styles**

Use these concrete layout values:

```css
.flow-screen{--flow-bg:#0f0f10;--flow-surface:#1a1a1c;--flow-surface-2:#222225;--flow-border:#303034;--flow-text:#f2f2f0;--flow-muted:#929297;position:fixed;inset:0;display:grid;grid-template-columns:minmax(0,1fr);height:100dvh;background:var(--flow-bg);color:var(--flow-text);overflow:hidden}
.flow-screen--agent-open{grid-template-columns:minmax(0,1fr) 320px}
.flow-workspace{position:relative;min-width:0;height:100dvh;overflow:hidden}
.flow-workspace .react-flow{background:var(--flow-bg)}
.flow-workspace .react-flow__edge-path{stroke:#55555b;stroke-width:1.5}
.flow-workspace .react-flow__edge.selected .react-flow__edge-path{stroke:var(--orange)}
.canvas-chrome{position:absolute;z-index:20;top:16px;left:16px;right:16px;display:flex;justify-content:space-between;pointer-events:none}
.canvas-chrome__group,.canvas-toolbar,.context-composer{pointer-events:auto;background:var(--flow-surface);border:1px solid var(--flow-border);box-shadow:0 16px 36px rgba(0,0,0,.28)}
.canvas-toolbar{position:absolute;z-index:20;left:16px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:4px;padding:6px;border-radius:14px}
.context-composer{position:absolute;z-index:18;left:50%;bottom:22px;transform:translateX(-50%);width:min(720px,calc(100% - 180px));padding:14px;border-radius:16px}
.agent-dock{min-width:0;height:100dvh;background:#151517;border-left:1px solid var(--flow-border);display:flex;flex-direction:column}
```

Buttons are square `38px` controls with `10px` radius; selected tool and primary submit use `var(--orange)`. Nodes are media-first, `240px` wide, with a `1px` neutral border and orange selected outline. Handles are dim by default and become opaque on node hover/selection. The composer uses a dominant textarea, one compact parameters row, small reference chips with real thumbnails, and a circular `42px` submit button. The Agent message list scrolls independently and the input stays at the bottom. Keep minimap lower-left and visually quieter than the composer.

- [ ] **Step 3: Add narrow and phone layouts**

At `max-width: 1099px`, keep the canvas full width and position `.agent-dock` fixed at the right with `width:min(360px,100vw)` and a scrim through `.flow-screen--agent-open::after`; keep the dock above the scrim. At `max-width: 640px`, make the composer a bottom sheet with `left:8px; right:8px; bottom:8px; width:auto; transform:none`, wrap parameter controls, move the toolbar to the bottom-left above the composer, and make the Agent full width. Ensure no control overlays selected node handles at the verification viewport.

- [ ] **Step 4: Add accessibility and motion CSS**

Use `:focus-visible` with a `2px` orange outline and `2px` offset for all canvas buttons/selects/textareas. Include a `.sr-only` utility scoped to `.flow-screen`. Under `@media (prefers-reduced-motion: reduce)`, disable transitions, React Flow animated edge dash movement, spinner animation, and drawer animation.

- [ ] **Step 5: Run static verification**

Run: `npm test && npm run lint && npm run build && git diff --check`

Expected: tests pass, lint/build succeed, and diff check prints no output.

- [ ] **Step 6: Commit**

```bash
git add app/create/flow/flow.css app/create/flow/page.js app/globals.css
git commit -m "style(flow): apply responsive dark canvas design"
```

---

### Task 8: Browser QA, Visual Comparison, and GitHub Push

**Files:**
- Modify only files with verified defects found during this task.
- Reference: `docs/superpowers/specs/assets/2026-07-14-canvas-workspace-option-1.png`

**Interfaces:**
- Uses the user's in-app browser for all local browser interaction.
- Validates the existing authenticated project at `/create/flow?project=2` when available.

- [ ] **Step 1: Start the app and perform a console smoke check**

Run: `npm run dev`

Expected: Next.js reports a ready local URL without compile errors. Open `/create/flow?project=2` in the user's in-app browser. Confirm there is no Next.js error overlay and no relevant application console error. Treat extension/injected `ui.js contentWindow` failures as external only when the source is demonstrably outside the app bundle.

- [ ] **Step 2: Verify the complete interaction flow**

Using the in-app browser, verify: add image; add video; select each and see kind-specific controls; edit prompt; connect source to target and see a reference chip; move nodes; undo; pan; select; fit view; generate and observe running/completion or preserved error; open/use/scroll/close Agent; reload and confirm autosaved canvas loads.

- [ ] **Step 3: Compare implementation and approved target at matching size**

Capture the app at `1440x1024` with a selected node, composer open, Agent open, and at least one connection. Put that capture and the approved target into one comparison input. Check hierarchy, `320px` Agent width, composer position, node media ratio, toolbar placement, spacing, borders, radii, type weight, and accidental copy. Fix visible mismatches and repeat the comparison once.

- [ ] **Step 4: Verify narrow layout**

Capture around `1024x768`. Confirm the Agent overlays instead of shrinking the canvas, its close button works, the composer wraps without clipping, and toolbar/composer do not cover the selected node's handles.

- [ ] **Step 5: Run final verification**

Run: `npm test && npm run lint && npm run build && git diff --check && git status --short --branch`

Expected: tests/lint/build pass, diff check is empty, and the branch contains only intentional committed changes.

- [ ] **Step 6: Commit QA fixes if needed**

```bash
git add app/create/flow app/globals.css test package.json package-lock.json
git commit -m "fix(flow): polish verified canvas interactions"
```

Skip this commit when browser QA required no code changes.

- [ ] **Step 7: Push to GitHub**

Run: `git push origin main`

Expected: `main` is pushed successfully and `git status --short --branch` no longer reports local commits ahead of `origin/main`.
