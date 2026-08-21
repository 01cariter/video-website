import assert from 'node:assert/strict';
import test from 'node:test';
import { modelSpecFor } from '@/lib/studio/model-catalog';
import { normalizeStudioRuntimeConfig } from '@/lib/studio/pricing';
import type { StudioNode, StudioNodeData } from '@/lib/studio/types';
import {
  buildQuickEditParameters,
  initialEditData,
  sourceReferences,
} from './QuickEditComposer.logic';

function imageNode(data: Partial<StudioNodeData>): StudioNode {
  return {
    id: 'image-1',
    type: 'image',
    x: 0,
    y: 0,
    width: 640,
    height: 640,
    rotation: 0,
    zIndex: 1,
    data: {
      kind: 'image',
      title: 'Source image',
      prompt: 'Original prompt',
      status: 'ready',
      aspect: '1:1',
      ...data,
    },
  };
}

test('inherits parameters when the source model supports image editing', () => {
  const runtime = normalizeStudioRuntimeConfig();
  const draft = initialEditData(
    imageNode({
      modelId: 'bytedance/seedream-5.0-pro',
      size: '1920x1080',
      n: 3,
      src: 'https://example.com/source.png',
    }),
    runtime,
  );

  assert.equal(draft.modelId, 'bytedance/seedream-5.0-pro');
  assert.equal((draft as StudioNodeData).size, '1920x1080');
  assert.equal(draft.n, 3);
  assert.equal(draft.prompt, '');
});

test('maps a 16:9 Grok edit to Seedream landscape parameters and geometry', () => {
  const runtime = normalizeStudioRuntimeConfig();
  const node = imageNode({
    modelId: 'xai/grok-imagine-image-2.0',
    aspect: '16:9',
    n: 3,
    quality: 'low',
    resolution: '2k',
    src: 'https://example.com/source.png',
  });
  node.width = 300;
  node.height = 169;
  const draft = initialEditData(
    node,
    runtime,
  );
  const parameters = buildQuickEditParameters(
    { ...draft, prompt: 'Add dramatic clouds' },
    runtime,
    node.data.src as string,
  );

  assert.notEqual(draft.modelId, 'xai/grok-imagine-image-2.0');
  assert.ok(modelSpecFor('image', draft.modelId, runtime).maxRefs > 0);
  assert.equal(draft.modelId, 'bytedance/seedream-5.0-pro');
  assert.equal((draft as StudioNodeData).size, '1280x720');
  assert.equal(draft.n, 3);
  assert.equal(draft.aspect, '16:9');
  assert.equal(parameters.size, '1280x720');
  assert.equal(parameters.aspect, '16:9');
  assert.ok(node.width > node.height);
});

test('uses uploaded media dimensions before a stale default aspect', () => {
  const runtime = normalizeStudioRuntimeConfig();
  const node = imageNode({
    modelId: 'xai/grok-imagine-image-2.0',
    aspect: '1:1',
    sourceWidth: 1920,
    sourceHeight: 1080,
    src: 'https://example.com/upload.png',
  });

  const draft = initialEditData(node, runtime);

  assert.equal(draft.modelId, 'bytedance/seedream-5.0-pro');
  assert.equal((draft as StudioNodeData).size, '1280x720');
  assert.equal(draft.aspect, '16:9');
});

test('maps a portrait Recraft size to GPT when Seedream is disabled', () => {
  const runtime = normalizeStudioRuntimeConfig({
    modelPolicy: {
      'bytedance/seedream-5.0-pro': { enabled: false },
    },
  });
  const node = imageNode({
    modelId: 'recraft/recraft-v4.1',
    aspect: '1:1',
    size: '1024x1820',
    n: 2,
    src: 'https://example.com/portrait.png',
  });
  node.width = 169;
  node.height = 300;

  const draft = initialEditData(node, runtime);
  const parameters = buildQuickEditParameters(
    { ...draft, prompt: 'Editorial portrait' },
    runtime,
    node.data.src as string,
  );

  assert.equal(draft.modelId, 'openai/gpt-image-2');
  assert.equal((draft as StudioNodeData).size, '1024x1536');
  assert.equal(draft.n, 2);
  assert.equal(draft.aspect, '2:3');
  assert.equal(parameters.size, '1024x1536');
  assert.equal(parameters.aspect, '2:3');
  assert.ok(node.width < node.height);
});

test('keeps the source image as the first reference while deduplicating extras', () => {
  const source = 'https://example.com/source.png';
  const refs = sourceReferences(
    source,
    [
      'https://example.com/other.png',
      source,
      'https://example.com/other.png',
      'https://example.com/third.png',
    ],
    3,
  );

  assert.deepEqual(refs, [
    source,
    'https://example.com/other.png',
    'https://example.com/third.png',
  ]);
});

test('builds submit parameters without leaking the existing output source', () => {
  const runtime = normalizeStudioRuntimeConfig();
  const source = 'https://example.com/source.png';
  const draft: StudioNodeData = {
    ...initialEditData(
      imageNode({
        modelId: 'openai/gpt-image-2',
        size: '1536x1024',
        quality: 'high',
        n: 2,
        src: source,
        posterSrc: 'https://example.com/poster.png',
      }),
      runtime,
    ),
    prompt: 'Turn day into night',
    refSrcs: ['https://example.com/extra.png', source],
  };

  const parameters = buildQuickEditParameters(draft, runtime, source);

  assert.deepEqual(parameters, {
    size: '1536x1024',
    quality: 'high',
    n: 2,
    aspect: '3:2',
    modelId: 'openai/gpt-image-2',
    refSrc: source,
    refSrcs: [source, 'https://example.com/extra.png'],
  });
  assert.equal('src' in parameters, false);
  assert.equal('posterSrc' in parameters, false);
});
