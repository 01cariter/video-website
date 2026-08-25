import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveStudioAutomationAction,
  workflowGroupPosition,
  workflowGroupSize,
} from './agent-automation';
import type { StudioNode } from './types';

function node(
  id: string,
  status: StudioNode['data']['status'],
  extras: Partial<StudioNode['data']> = {},
): StudioNode {
  return {
    id,
    type: extras.kind === 'video' ? 'video' : 'image',
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    rotation: 0,
    zIndex: 1,
    data: {
      kind: extras.kind === 'video' ? 'video' : 'image',
      title: id,
      prompt: 'Prompt',
      status,
      aspect: '16:9',
      ...extras,
    },
  };
}

test('waits for a referenced image and starts with its generated asset', () => {
  const source = node('source', 'generating');
  const video = node('video', 'idle', {
    kind: 'video',
    agentAutoGenerate: true,
    agentDependsOn: ['source'],
    agentReferenceNodeIds: ['source'],
  });
  assert.deepEqual(resolveStudioAutomationAction(video, [source, video]), {
    type: 'wait',
  });

  source.data.status = 'ready';
  source.data.src = 'https://example.com/generated.png';
  assert.deepEqual(resolveStudioAutomationAction(video, [source, video]), {
    type: 'start',
    references: ['https://example.com/generated.png'],
  });
});

test('blocks dependent generation when a prerequisite fails', () => {
  const source = node('source', 'error');
  const video = node('video', 'idle', {
    kind: 'video',
    agentAutoGenerate: true,
    agentDependsOn: ['source'],
  });
  const action = resolveStudioAutomationAction(video, [source, video]);
  assert.equal(action.type, 'fail');
});

test('lays out workflow nodes on a compact 24px-aligned grid', () => {
  const group = { x: 240, y: -48 };

  assert.deepEqual(workflowGroupPosition(group, 0), { x: 264, y: 24 });
  assert.deepEqual(workflowGroupPosition(group, 1), { x: 600, y: 24 });
  assert.deepEqual(workflowGroupPosition(group, 3), { x: 264, y: 360 });
  assert.deepEqual(workflowGroupSize(4), { width: 1032, height: 744 });
});
