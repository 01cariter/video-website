import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStudioProjectDraft,
  listStudioProjects,
  normalizeStudioProject,
  saveStudioProject,
} from './store';

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

test('keeps local Studio caches isolated between signed-in accounts', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });

  try {
    const first = saveStudioProject(
      createStudioProjectDraft({ title: 'First account', blank: true }),
      'user-a',
    );
    const second = saveStudioProject(
      createStudioProjectDraft({ title: 'Second account', blank: true }),
      'user-b',
    );

    assert.equal(
      listStudioProjects('user-a').some((project) => project.id === first.id),
      true,
    );
    assert.equal(
      listStudioProjects('user-a').some((project) => project.id === second.id),
      false,
    );
    assert.equal(
      listStudioProjects('user-b').some((project) => project.id === second.id),
      true,
    );
    assert.equal(
      listStudioProjects('user-b').some((project) => project.id === first.id),
      false,
    );
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('creates a project with an uploaded reference and pending Agent attachment', () => {
  const reference = {
    id: 'reference-1',
    type: 'image' as const,
    x: 80,
    y: 80,
    width: 320,
    height: 240,
    rotation: 0,
    zIndex: 0,
    data: {
      kind: 'image' as const,
      title: 'Reference',
      prompt: '',
      status: 'ready' as const,
      aspect: '4:3',
      src: 'https://example.com/reference.jpg',
    },
  };
  const project = createStudioProjectDraft({
    pendingPrompt: 'Use this reference',
    initialNodes: [reference],
    pendingAgentAttachmentIds: [reference.id],
  });

  assert.deepEqual(project.nodes, [reference]);
  assert.deepEqual(project.pendingAgentAttachmentIds, ['reference-1']);
});

test('bounds untrusted Studio documents before rendering or persistence', () => {
  const base = legacyProject([]);
  const oversized = normalizeStudioProject({
    ...base,
    title: 'T'.repeat(500),
    nodes: Array.from({ length: 620 }, (_, index) => ({
      ...base.nodes[0],
      id: `node-${index}`,
      data: {
        ...base.nodes[0].data,
        prompt: index === 0 ? 'P'.repeat(25_000) : 'Prompt',
        text: index === 0 ? 'X'.repeat(120_000) : 'Text',
      },
    })),
    messages: Array.from({ length: 520 }, (_, index) => ({
      id: `message-${index}`,
      role: 'user',
      parts: [{ type: 'text', text: `Message ${index}` }],
    })),
  });

  assert.equal(oversized?.title.length, 160);
  assert.equal(oversized?.nodes.length, 500);
  assert.equal(oversized?.nodes[0].data.prompt.length, 20_000);
  assert.equal(oversized?.nodes[0].data.text?.length, 100_000);
  assert.equal(oversized?.messages.length, 400);
  assert.equal(
    normalizeStudioProject({ ...base, id: 'x'.repeat(161) }),
    null,
  );
});
