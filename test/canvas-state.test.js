import test from 'node:test';
import assert from 'node:assert/strict';

import { asCanvasJson, normalizeCanvas, normalizeCanvasList } from '../lib/canvas-state.js';

test('normalizes a legacy JSONB string into a canvas array', () => {
  const legacyValue = JSON.stringify([{ id: 'scene-1' }]);

  assert.deepEqual(normalizeCanvasList(legacyValue), [{ id: 'scene-1' }]);
});

test('falls back to an empty array for malformed or non-array canvas state', () => {
  assert.deepEqual(normalizeCanvasList('{not-json'), []);
  assert.deepEqual(normalizeCanvasList({ id: 'scene-1' }), []);
  assert.deepEqual(normalizeCanvasList(null), []);
});

test('normalizes both node and edge collections on a canvas row', () => {
  const row = {
    id: 2,
    nodes: JSON.stringify([{ id: 'scene-1' }]),
    edges: JSON.stringify([{ id: 'edge-1' }]),
  };

  assert.deepEqual(normalizeCanvas(row), {
    id: 2,
    nodes: [{ id: 'scene-1' }],
    edges: [{ id: 'edge-1' }],
  });
});

test('passes a real array to the database JSON encoder', () => {
  let received;
  const sql = {
    json(value) {
      received = value;
      return { encoded: value };
    },
  };

  const encoded = asCanvasJson(sql, JSON.stringify([{ id: 'scene-1' }]));

  assert.deepEqual(received, [{ id: 'scene-1' }]);
  assert.deepEqual(encoded, { encoded: [{ id: 'scene-1' }] });
});
