import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStudioProject } from './store';

function legacyProject(appliedToolCallIds?: string[]) {
  return {
    id: 'legacy-project',
    title: 'Legacy',
    nodes: [
      {
        id: 'huge-node',
        type: 'image',
        x: 0,
        y: 0,
        width: 1_000_000_000,
        height: 1_000_000_000,
        data: { title: 'Huge', status: 'ready', aspect: '1:1' },
      },
    ],
    messages: [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-addCanvasNode',
            toolCallId: 'legacy-tool',
            state: 'output-available',
            output: { operation: { type: 'add_node' } },
          },
        ],
      },
    ],
    ...(appliedToolCallIds === undefined ? {} : { appliedToolCallIds }),
  };
}

test('migrates legacy tool outputs to explicit receipts without replaying them', () => {
  const project = normalizeStudioProject(legacyProject());

  assert.deepEqual(project?.appliedToolCallIds, ['legacy-tool']);
});

test('preserves an explicitly empty receipt list for new projects', () => {
  const project = normalizeStudioProject(legacyProject([]));

  assert.deepEqual(project?.appliedToolCallIds, []);
});

test('clamps corrupt legacy node dimensions', () => {
  const project = normalizeStudioProject(legacyProject([]));

  assert.equal(project?.nodes[0].width, 10_000);
  assert.equal(project?.nodes[0].height, 10_000);
});
