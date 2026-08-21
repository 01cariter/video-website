import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';
import {
  applyNewStudioToolOutputs,
  buildCanvasNodeSnapshots,
  canvasInventoryText,
  MAX_SELECTED_CANVAS_NODES,
  normalizeCanvasNodeSnapshots,
  normalizeSelectedCanvasIds,
  studioAgentOperationId,
} from './agent-context';
import type { StudioCanvasOperation, StudioNode } from './types';

function node(id: string, text = ''): StudioNode {
  return {
    id,
    type: text ? 'text' : 'image',
    x: 10,
    y: 20,
    width: 300,
    height: 200,
    rotation: 0,
    zIndex: 1,
    data: {
      kind: text ? 'text' : 'image',
      title: `Node ${id}`,
      prompt: `Prompt ${id}`,
      text,
      status: 'ready',
      aspect: '3:2',
      modelId: 'openai/gpt-image-2',
      quality: 'high',
      src: text ? undefined : 'https://example.com/image.png',
    },
  };
}

test('freezes selected canvas content first with model parameters and preview', () => {
  const snapshots = buildCanvasNodeSnapshots(
    [node('first'), node('selected', 'Full selected text')],
    ['selected'],
  );

  assert.equal(snapshots[0].id, 'selected');
  assert.equal(snapshots[0].selected, true);
  assert.equal(snapshots[0].text, 'Full selected text');
  assert.equal(snapshots[0].modelId, 'openai/gpt-image-2');
  assert.equal(snapshots[0].parameters?.quality, 'high');
  assert.equal(snapshots[1].text, undefined);
  assert.equal(canvasInventoryText(snapshots).includes('https://'), false);
});

test('normalizes request snapshots and rejects invalid selection shapes', () => {
  const snapshots = normalizeCanvasNodeSnapshots(
    buildCanvasNodeSnapshots([node('n1')], ['n1']),
  );
  assert.ok(snapshots);
  assert.equal(normalizeSelectedCanvasIds(['n1', 'missing'], snapshots), null);
  assert.equal(normalizeSelectedCanvasIds('n1', snapshots), null);
  assert.equal(
    normalizeSelectedCanvasIds(
      Array.from({ length: MAX_SELECTED_CANVAS_NODES + 1 }, (_, index) =>
        index === 0 ? 'n1' : `missing-${index}`,
      ),
      snapshots,
    ),
    null,
  );
});

test('applies a persisted tool output once and assigns a stable node id', () => {
  const messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-addCanvasNode',
          toolCallId: 'tool-123',
          state: 'output-available',
          input: { kind: 'image' },
          output: {
            operation: {
              type: 'add_node',
              node: { kind: 'image', prompt: 'A quiet harbor' },
            },
          },
        },
      ],
    },
  ] as UIMessage[];
  const seen = new Set<string>();
  const ids: string[] = [];
  const apply = (operation: StudioCanvasOperation) => {
    if (operation.type === 'add_node' && operation.node.id) {
      ids.push(operation.node.id);
    }
  };

  applyNewStudioToolOutputs(messages, seen, apply);
  applyNewStudioToolOutputs(messages, seen, apply);

  assert.deepEqual(ids, [studioAgentOperationId('tool-123', 0)]);
});

test('uses explicit persisted receipts across refreshes', () => {
  const messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-addCanvasNode',
          toolCallId: 'already-applied',
          state: 'output-available',
          input: { kind: 'image' },
          output: {
            operation: { type: 'add_node', node: { kind: 'image' } },
          },
        },
      ],
    },
  ] as UIMessage[];
  let applications = 0;

  applyNewStudioToolOutputs(
    messages,
    new Set(['already-applied']),
    () => {
      applications += 1;
    },
  );

  assert.equal(applications, 0);
});

test('keeps a failed canvas operation retryable', () => {
  const messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-updateCanvasNode',
          toolCallId: 'retry-me',
          state: 'output-available',
          input: { id: 'missing' },
          output: {
            operation: {
              type: 'update_node',
              id: 'missing',
              patch: { title: 'New title' },
            },
          },
        },
      ],
    },
  ] as UIMessage[];
  const seen = new Set<string>();

  const applied = applyNewStudioToolOutputs(messages, seen, () => {
    throw new Error('not applied');
  });

  assert.deepEqual(applied, []);
  assert.equal(seen.has('retry-me'), false);
});
