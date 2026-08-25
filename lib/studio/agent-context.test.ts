import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';
import {
  applyNewStudioToolOutputs,
  buildStudioAgentMessageMetadata,
  buildCanvasNodeSnapshots,
  filePartsForStudioNodes,
  canvasInventoryText,
  MAX_SELECTED_CANVAS_NODES,
  normalizeCanvasNodeSnapshots,
  normalizeSelectedCanvasIds,
  studioAgentMessageContext,
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

test('persists referenced canvas nodes and Skills in the user message metadata', () => {
  const metadata = buildStudioAgentMessageMetadata(
    [node('image')],
    ['image'],
    ['script-to-storyboard-video'],
  );
  const message = {
    id: 'user-1',
    role: 'user',
    metadata,
    parts: [{ type: 'text', text: 'Use this image.' }],
  } as UIMessage;
  const context = studioAgentMessageContext(message);

  assert.equal(context?.attachments[0].id, 'image');
  assert.equal(context?.attachments[0].modelId, 'openai/gpt-image-2');
  assert.equal(context?.skills[0].id, 'script-to-storyboard-video');
  assert.deepEqual(filePartsForStudioNodes([node('image')], ['image']), [
    {
      type: 'file',
      filename: 'Node image',
      mediaType: 'image',
      url: 'https://example.com/image.png',
    },
  ]);
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

test('keeps workflow model, parameters, references, and generation intent', () => {
  const messages = [
    {
      id: 'assistant-workflow',
      role: 'assistant',
      parts: [
        {
          type: 'tool-createCanvasWorkflow',
          toolCallId: 'workflow-tool',
          state: 'output-available',
          input: {},
          output: {
            operations: [
              {
                type: 'add_node',
                node: {
                  kind: 'video',
                  prompt: 'Animate this frame.',
                  modelId: 'minimax/minimax-h3',
                  parameters: { duration: 10, videoResolution: '2k' },
                  autoGenerate: true,
                  dependsOn: ['image-node'],
                  referenceNodeIds: ['image-node'],
                  groupId: 'group-node',
                  groupIndex: 2,
                },
              },
            ],
          },
        },
      ],
    },
  ] as UIMessage[];
  const operations: StudioCanvasOperation[] = [];

  applyNewStudioToolOutputs(messages, new Set(), (operation) => {
    operations.push(operation);
  });

  const operation = operations[0];
  assert.equal(operation.type, 'add_node');
  if (operation.type !== 'add_node') return;
  assert.equal(operation.node.modelId, 'minimax/minimax-h3');
  assert.equal(operation.node.parameters?.duration, 10);
  assert.equal(operation.node.autoGenerate, true);
  assert.deepEqual(operation.node.referenceNodeIds, ['image-node']);
  assert.equal(operation.node.groupId, 'group-node');
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
