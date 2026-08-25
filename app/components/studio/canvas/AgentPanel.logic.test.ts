import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';
import { workflowProgress, workflowReceiptFromPart } from './AgentPanel.logic';
import type { StudioNode } from '@/lib/studio/types';

test('reads persisted workflow receipts and reflects live canvas progress', () => {
  const part = {
    type: 'tool-createCanvasWorkflow',
    toolCallId: 'workflow-1',
    state: 'output-available',
    input: {},
    output: {
      workflow: {
        id: 'workflow-1',
        title: 'Storyboard video',
        nodes: [
          {
            id: 'image-1',
            key: 'image',
            kind: 'image',
            title: 'Hero frame',
            modelId: 'xai/grok-imagine-image-2.0',
            dependsOn: [],
            autoGenerate: true,
          },
          {
            id: 'video-1',
            key: 'video',
            kind: 'video',
            title: 'Hero clip',
            modelId: 'minimax/minimax-h3',
            dependsOn: ['image-1'],
            autoGenerate: true,
          },
        ],
      },
    },
  } as UIMessage['parts'][number];
  const workflow = workflowReceiptFromPart(part);
  assert.ok(workflow);

  const nodes = workflow.nodes.map(
    (receipt, index): StudioNode => ({
      id: receipt.id,
      type: receipt.kind,
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      rotation: 0,
      zIndex: index,
      data: {
        kind: receipt.kind,
        title: receipt.title,
        prompt: 'Prompt',
        status: index === 0 ? 'ready' : 'generating',
        aspect: '16:9',
      },
    }),
  );
  assert.deepEqual(workflowProgress(workflow, nodes), {
    ready: 1,
    errors: 0,
    running: 1,
    total: 2,
    complete: false,
  });
});
