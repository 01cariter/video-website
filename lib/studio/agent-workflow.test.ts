import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_STUDIO_RUNTIME_CONFIG } from './pricing';
import { buildStudioAgentWorkflow } from './agent-workflow';

test('builds a grouped Grok-to-Hailuo workflow with real dependencies and parameters', () => {
  const result = buildStudioAgentWorkflow({
    toolCallId: 'workflow-1',
    canvasNodeIds: ['source-image'],
    runtime: DEFAULT_STUDIO_RUNTIME_CONFIG,
    workflow: {
      title: 'Storyboard to video',
      nodes: [
        {
          key: 'script',
          kind: 'text',
          prompt: 'Write a concise commercial script.',
          modelId: 'deepseek/deepseek-v4-flash',
        },
        {
          key: 'shot-1',
          kind: 'image',
          prompt: 'Cinematic opening frame inspired by the selected product.',
          modelId: 'xai/grok-imagine-image-2.0',
          parameters: {
            aspect: '16:9',
            quality: 'medium',
            resolution: '2k',
            n: 1,
          },
          dependsOn: ['script', 'source-image'],
        },
        {
          key: 'clip-1',
          kind: 'video',
          prompt: 'Animate the opening frame with a slow camera push.',
          modelId: 'minimax/minimax-h3',
          parameters: {
            aspect: '16:9',
            duration: 10,
            videoResolution: '2k',
            generateAudio: false,
          },
          referenceNodeIds: ['shot-1'],
        },
      ],
    },
  });

  assert.ok(result.workflow.groupId);
  assert.equal(result.operations.length, 4);
  const image = result.operations[2];
  const video = result.operations[3];
  assert.equal(image.type, 'add_node');
  assert.equal(video.type, 'add_node');
  if (image.type !== 'add_node' || video.type !== 'add_node') return;
  assert.equal(image.node.modelId, 'xai/grok-imagine-image-2.0');
  assert.equal(image.node.parameters?.resolution, '2k');
  assert.deepEqual(image.node.dependsOn, [
    result.workflow.nodes[0].id,
    'source-image',
  ]);
  assert.equal(video.node.modelId, 'minimax/minimax-h3');
  assert.equal(video.node.parameters?.duration, 10);
  assert.deepEqual(video.node.referenceNodeIds, [
    result.workflow.nodes[1].id,
  ]);
  assert.deepEqual(video.node.dependsOn, [result.workflow.nodes[1].id]);
  assert.equal(video.node.autoGenerate, true);
  assert.equal(video.node.groupId, result.workflow.groupId);
});

test('normalizes invalid field values and rejects missing dependencies', () => {
  const normalized = buildStudioAgentWorkflow({
    toolCallId: 'workflow-2',
    canvasNodeIds: [],
    runtime: DEFAULT_STUDIO_RUNTIME_CONFIG,
    workflow: {
      nodes: [
        {
          key: 'video',
          kind: 'video',
          prompt: 'A short clip.',
          modelId: 'minimax/minimax-h3',
          parameters: { duration: 99, aspect: 'not-real' },
        },
      ],
    },
  });
  const operation = normalized.operations[0];
  assert.equal(operation.type, 'add_node');
  if (operation.type === 'add_node') {
    assert.equal(operation.node.parameters?.duration, 15);
    assert.equal(operation.node.parameters?.aspect, '16:9');
  }

  const inferred = buildStudioAgentWorkflow({
    toolCallId: 'workflow-inferred',
    canvasNodeIds: [],
    runtime: DEFAULT_STUDIO_RUNTIME_CONFIG,
    workflow: {
      nodes: [
        {
          key: 'frame',
          kind: 'image',
          prompt: 'A cinematic storyboard shot for a widescreen video.',
          modelId: 'xai/grok-imagine-image-2.0',
        },
      ],
    },
  });
  const inferredOperation = inferred.operations[0];
  assert.equal(inferredOperation.type, 'add_node');
  if (inferredOperation.type === 'add_node') {
    assert.equal(inferredOperation.node.parameters?.aspect, '16:9');
  }

  assert.throws(
    () =>
      buildStudioAgentWorkflow({
        toolCallId: 'workflow-3',
        canvasNodeIds: [],
        runtime: DEFAULT_STUDIO_RUNTIME_CONFIG,
        workflow: {
          nodes: [
            {
              key: 'image',
              kind: 'image',
              prompt: 'Frame',
              dependsOn: ['missing'],
            },
          ],
        },
      }),
    /does not exist/,
  );
});
