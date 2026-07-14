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

function makeNodes() {
  return [
    { id: 'a', position: { x: 1, y: 2 }, data: { title: 'Source', prompt: 'first', poster: '/a.jpg' } },
    { id: 'b', position: { x: 3, y: 4 }, data: { title: 'Target', prompt: 'second' } },
  ];
}

const edges = [{ id: 'a-b', source: 'a', target: 'b' }];

test('derives the selected node without assuming nodes is always populated', () => {
  const nodes = makeNodes();

  assert.equal(getSelectedNode(nodes, 'b')?.id, 'b');
  assert.equal(getSelectedNode([], 'b'), null);
  assert.equal(getSelectedNode(nodes, null), null);
});

test('derives compact incoming references from source nodes', () => {
  const nodes = makeNodes();

  assert.deepEqual(getIncomingRefs(nodes, edges, 'b'), [
    { id: 'a', poster: '/a.jpg', prompt: 'first', title: 'Source' },
  ]);
  assert.deepEqual(getIncomingRefs(nodes, edges, 'a'), []);
});

test('creates snapshots isolated from later canvas mutations', () => {
  const nodes = makeNodes();
  const snapshot = createCanvasSnapshot(nodes, edges);

  nodes[0].data.title = 'Changed after snapshot';
  nodes[0].position.x = 99;

  assert.equal(snapshot.nodes[0].data.title, 'Source');
  assert.equal(snapshot.nodes[0].position.x, 1);
});

test('caps history at the requested limit', () => {
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

test('persists the canvas with the existing API contract', async () => {
  const calls = [];
  const payload = { projectId: 2, nodes: [], edges: [], name: 'Canvas' };
  const okFetch = async (...args) => {
    calls.push(args);
    return { ok: true };
  };

  assert.equal(await persistCanvas(okFetch, payload), 'saved');
  assert.equal(calls[0][0], '/api/canvas');
  assert.deepEqual(calls[0][1], {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
});

test('rejects failed canvas saves', async () => {
  await assert.rejects(
    persistCanvas(async () => ({ ok: false, status: 500 }), { projectId: 2, nodes: [], edges: [] }),
    /Canvas save failed: 500/,
  );
});
