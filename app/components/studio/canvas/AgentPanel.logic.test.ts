import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';
import {
  buildStudioWorkflowSummaryMessage,
  composerTriggerAtEnd,
  filterCanvasMentionNodes,
  removeComposerTrigger,
  studioWorkflowLanguage,
  studioWorkflowSummaryMessageId,
  workflowProgress,
  workflowReceiptFromPart,
  workflowReceiptsFromMessages,
} from './AgentPanel.logic';
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
            modelId: 'spacexai/grok-imagine-image-2.0',
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

test('keeps a workflow run active until every generated node settles', () => {
  const part = {
    type: 'tool-createCanvasWorkflow',
    toolCallId: 'workflow-final',
    state: 'output-available',
    input: {},
    output: {
      workflow: {
        id: 'workflow-final',
        title: 'Campaign film',
        nodes: [
          {
            id: 'frame-final',
            key: 'frame',
            kind: 'image',
            title: 'Lead frame',
            modelId: 'spacexai/grok-imagine-image-2.0',
            dependsOn: [],
            autoGenerate: true,
          },
          {
            id: 'clip-final',
            key: 'clip',
            kind: 'video',
            title: 'Lead clip',
            modelId: 'minimax/minimax-h3',
            dependsOn: ['frame-final'],
            autoGenerate: true,
          },
        ],
      },
    },
  } as UIMessage['parts'][number];
  const messages = [
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: '生成一张图和一段视频' }],
    },
    { id: 'assistant-1', role: 'assistant', parts: [part] },
  ] as UIMessage[];
  const [workflow] = workflowReceiptsFromMessages(messages);
  assert.ok(workflow);

  const nodes: StudioNode[] = workflow.nodes.map((receipt, index) => ({
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
  }));

  assert.equal(buildStudioWorkflowSummaryMessage(workflow, nodes), undefined);
  assert.equal(studioWorkflowLanguage(messages, workflow.id), 'zh');

  nodes[1] = {
    ...nodes[1],
    data: {
      ...nodes[1].data,
      status: 'error',
      error: 'Provider polling timed out.',
    },
  };
  const summary = buildStudioWorkflowSummaryMessage(workflow, nodes);
  assert.equal(summary?.id, studioWorkflowSummaryMessageId(workflow.id));
  assert.match(
    summary?.parts[0]?.type === 'text' ? summary.parts[0].text : '',
    /Run finished with 1 failed task/,
  );
  assert.match(
    summary?.parts[0]?.type === 'text' ? summary.parts[0].text : '',
    /Lead clip: Provider polling timed out/,
  );
  const chineseSummary = buildStudioWorkflowSummaryMessage(
    workflow,
    nodes,
    studioWorkflowLanguage(messages, workflow.id),
  );
  assert.match(
    chineseSummary?.parts[0]?.type === 'text'
      ? chineseSummary.parts[0].text
      : '',
    /任务结束，1 个任务失败/,
  );
});

test('distinguishes canvas @ mentions from / skill triggers', () => {
  assert.deepEqual(composerTriggerAtEnd('Compare @主视觉'), {
    kind: 'canvas',
    query: '主视觉',
    start: 8,
  });
  assert.deepEqual(composerTriggerAtEnd('Use /storyboard'), {
    kind: 'skill',
    query: 'storyboard',
    start: 4,
  });
  assert.equal(composerTriggerAtEnd('email@example.com'), undefined);
});

test('finds canvas content by title, prompt, type, and model while excluding attached nodes', () => {
  const nodes: StudioNode[] = [
    {
      id: 'hero',
      type: 'image',
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      rotation: 0,
      zIndex: 0,
      data: {
        kind: 'image',
        title: '主视觉',
        prompt: 'orange astronaut portrait',
        status: 'ready',
        aspect: '1:1',
        modelId: 'spacexai/grok-imagine-image-2.0',
      },
    },
    {
      id: 'script',
      type: 'text',
      x: 320,
      y: 0,
      width: 300,
      height: 220,
      rotation: 0,
      zIndex: 1,
      data: {
        kind: 'text',
        title: 'Opening script',
        prompt: '',
        text: 'A quiet station at dawn',
        status: 'ready',
        aspect: '1:1',
      },
    },
  ];

  assert.deepEqual(
    filterCanvasMentionNodes(nodes, '宇航员', []).map((node) => node.id),
    [],
  );
  assert.deepEqual(
    filterCanvasMentionNodes(nodes, 'astronaut', []).map((node) => node.id),
    ['hero'],
  );
  assert.deepEqual(
    filterCanvasMentionNodes(nodes, 'text', []).map((node) => node.id),
    ['script'],
  );
  assert.deepEqual(
    filterCanvasMentionNodes(nodes, 'grok', []).map((node) => node.id),
    ['hero'],
  );
  assert.deepEqual(filterCanvasMentionNodes(nodes, '', ['hero']), [nodes[1]]);
});

test('removes only the active composer trigger after an attachment is chosen', () => {
  const input = 'Compare this with @主视觉';
  const trigger = composerTriggerAtEnd(input);
  assert.ok(trigger);
  assert.equal(removeComposerTrigger(input, trigger), 'Compare this with ');
});
