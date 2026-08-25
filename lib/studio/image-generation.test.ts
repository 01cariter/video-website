import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  imageParametersFromBody,
  prepareStudioImageRequest,
  StudioImageValidationError,
} from './image-generation';
import { estimateStudioCredits } from './pricing';

describe('Studio image parameter contracts', () => {
  it('prefers nested parameters over legacy top-level fields', () => {
    assert.deepEqual(
      imageParametersFromBody({
        aspect: '1:1',
        n: 1,
        parameters: { aspect: '16:9', n: 2, quality: 'low' },
      }),
      { aspect: '16:9', n: 2, quality: 'low' },
    );
  });

  it('rejects unsupported model ids, including the old Recraft id', () => {
    for (const modelId of [
      'recraft/recraft-v4.1-pro',
      'xai/grok-imagine-image',
      'unknown/image-model',
    ]) {
      assert.throws(
        () => prepareStudioImageRequest({ modelId, prompt: 'A poster.' }),
        StudioImageValidationError,
      );
    }
  });

  it('rejects stale parameters that do not belong to the selected model', () => {
    assert.throws(
      () =>
        prepareStudioImageRequest({
          modelId: 'bytedance/seedream-5.0-pro',
          prompt: 'A poster.',
          parameters: { quality: 'high' },
        }),
      /Unsupported image parameter for this model: quality/,
    );
    assert.throws(
      () =>
        prepareStudioImageRequest({
          modelId: 'spacexai/grok-imagine-image-2.0',
          prompt: 'A poster.',
          parameters: { n: 1.5 },
        }),
      /n must be an integer/,
    );
  });
});

describe('Studio image Gateway payload and upstream cost', () => {
  it('maps all four Grok quality/resolution prices to xAI options', () => {
    const cases = [
      ['medium', '1k', 60_000],
      ['low', '1k', 40_000],
      ['medium', '2k', 80_000],
      ['low', '2k', 60_000],
    ] as const;

    for (const [quality, resolution, expected] of cases) {
      const request = prepareStudioImageRequest({
        modelId: 'spacexai/grok-imagine-image-2.0',
        prompt: 'A cinematic harbor.',
        parameters: { aspect: '16:9', quality, resolution },
      });
      assert.equal(request.upstreamUsdMicros, expected);
      assert.equal(request.providerCall.mode, 'image-model');
      assert.equal(request.providerCall.aspectRatio, '16:9');
      if (quality === 'low' || resolution === '2k') {
        assert.deepEqual(request.providerCall.providerOptions, {
          xai: {
            ...(quality === 'low' ? { quality } : {}),
            ...(resolution === '2k' ? { resolution } : {}),
          },
        });
      }
    }
  });

  it('splits Seedream into native single-image calls and includes references', () => {
    const request = prepareStudioImageRequest({
      modelId: 'bytedance/seedream-5.0-pro',
      prompt: 'cat',
      parameters: { size: '1280x720', n: 2 },
      referenceImages: ['https://cdn.example.com/reference.png'],
    });

    assert.equal(request.upstreamUsdMicros, 70_001);
    assert.deepEqual(request.providerCall, {
      mode: 'image-model',
      model: 'bytedance/seedream-5.0-pro',
      prompt: {
        text: 'cat',
        images: ['https://cdn.example.com/reference.png'],
      },
      n: 2,
      size: '1280x720',
      maxImagesPerCall: 1,
    });
  });

  it('sends Grok edit references and includes their input charge', () => {
    const request = prepareStudioImageRequest({
      modelId: 'spacexai/grok-imagine-image-2.0',
      prompt: 'Keep the subject and change the lighting.',
      referenceImages: [
        'https://cdn.example.com/one.png',
        'https://cdn.example.com/two.png',
      ],
    });

    assert.equal(request.upstreamUsdMicros, 80_000);
    assert.equal(request.providerCall.mode, 'image-model');
    assert.deepEqual(request.providerCall.prompt, {
      text: 'Keep the subject and change the lighting.',
      images: [
        'https://cdn.example.com/one.png',
        'https://cdn.example.com/two.png',
      ],
    });
  });

  it('uses the published GPT Image 2 output matrix plus token input reserve', () => {
    const cases = [
      ['low', '1024x1024', 6_015],
      ['low', '1536x1024', 5_015],
      ['medium', '1024x1024', 53_015],
      ['medium', '1024x1536', 41_015],
      ['high', '1024x1024', 211_015],
      ['high', '1536x1024', 165_015],
    ] as const;

    for (const [quality, size, expected] of cases) {
      const request = prepareStudioImageRequest({
        modelId: 'openai/gpt-image-2',
        prompt: 'cat',
        parameters: { quality, size },
      });
      assert.equal(request.upstreamUsdMicros, expected);
      assert.equal(request.providerCall.mode, 'image-model');
      assert.equal(request.providerCall.size, size);
      assert.deepEqual(request.providerCall.providerOptions, {
        openai: { quality },
      });
    }
  });

  it('reserves GPT Image 2 high-fidelity image-input tokens', () => {
    const withoutReference = prepareStudioImageRequest({
      modelId: 'openai/gpt-image-2',
      prompt: 'cat',
    });
    const withReference = prepareStudioImageRequest({
      modelId: 'openai/gpt-image-2',
      prompt: 'cat',
      referenceImages: ['data:image/png;base64,AAAA'],
    });
    assert.equal(
      withReference.upstreamUsdMicros - withoutReference.upstreamUsdMicros,
      49_920,
    );
  });

  it('prices and sends Recraft vector output explicitly', () => {
    const request = prepareStudioImageRequest({
      modelId: 'recraft/recraft-v4.1',
      prompt: 'A clean logo.',
      parameters: {
        n: 2,
        size: '1365x1024',
        style: 'vector_illustration',
      },
    });
    assert.equal(request.upstreamUsdMicros, 160_000);
    assert.deepEqual(request.providerCall, {
      mode: 'image-model',
      model: 'recraft/recraft-v4.1',
      prompt: 'A clean logo.',
      n: 2,
      size: '1365x1024',
      providerOptions: { recraft: { style: 'vector_illustration' } },
    });
  });

  it('aggregates n before the shared credit rounding policy', () => {
    const request = prepareStudioImageRequest({
      modelId: 'recraft/recraft-v4.1',
      prompt: 'A campaign illustration.',
      parameters: { n: 3 },
    });
    const pricing = estimateStudioCredits({
      kind: 'image',
      modelId: request.modelId,
      parameters: request.parameters,
      prompt: request.prompt,
    });

    assert.equal(request.upstreamUsdMicros, 105_000);
    assert.equal(pricing.credits, 16);
  });

  it('uses a language-model call contract for Gemini image output', () => {
    const request = prepareStudioImageRequest({
      modelId: 'google/gemini-3.1-flash-image',
      prompt: 'cat',
      parameters: {
        aspect: '21:9',
        imageSize: '2K',
        thinkingLevel: 'high',
        n: 2,
      },
    });

    assert.equal(request.upstreamUsdMicros, 226_579);
    assert.deepEqual(request.providerCall, {
      mode: 'language-model',
      model: 'google/gemini-3.1-flash-image',
      prompt: 'cat',
      referenceImages: [],
      count: 2,
      providerOptions: {
        google: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '21:9', imageSize: '2K' },
          thinkingConfig: { thinkingLevel: 'high' },
        },
      },
    });
  });
});

describe('Studio image reference-image contracts', () => {
  it('enforces each model reference limit and rejects insecure sources', () => {
    assert.throws(
      () =>
        prepareStudioImageRequest({
          modelId: 'openai/gpt-image-2',
          prompt: 'Edit this.',
          referenceImages: [
            'https://example.com/1.png',
            'https://example.com/2.png',
            'https://example.com/3.png',
            'https://example.com/4.png',
            'https://example.com/5.png',
          ],
        }),
      /at most 4/,
    );
    assert.throws(
      () =>
        prepareStudioImageRequest({
          modelId: 'openai/gpt-image-2',
          prompt: 'Edit this.',
          referenceImages: ['http://example.com/reference.png'],
        }),
      /Invalid reference image source/,
    );
  });

  it('rejects references for Recraft', () => {
    assert.throws(
      () =>
        prepareStudioImageRequest({
          modelId: 'recraft/recraft-v4.1',
          prompt: 'Edit this.',
          referenceImages: ['https://example.com/reference.png'],
        }),
      /does not support reference images/,
    );
  });

  it('migrates the former xAI Gateway namespace', () => {
    const request = prepareStudioImageRequest({
      modelId: 'xai/grok-imagine-image-2.0',
      prompt: 'A cinematic harbor.',
    });
    assert.equal(request.modelId, 'spacexai/grok-imagine-image-2.0');
  });
});
