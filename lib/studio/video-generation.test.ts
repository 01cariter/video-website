import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildStudioVideoGeneratePayload,
  estimateStudioVideoUpstreamUsdMicros,
  normalizeStudioVideoRequest,
  STUDIO_VIDEO_MODEL_IDS,
  VideoGenerationValidationError,
  videoParametersFromBody,
  videoReferenceFromBody,
} from './video-generation';
import { priceStudioUsage } from './pricing';

const VALID_PARAMETERS = {
  'bytedance/seedance-2.5': {
    aspect: '21:9',
    duration: 30,
    videoResolution: '1080p',
    generateAudio: true,
  },
  'minimax/minimax-h3': {
    aspect: '4:3',
    duration: 15,
    videoResolution: '2k',
    generateAudio: true,
  },
  'xai/grok-imagine-video-1.5': {
    aspect: '2:3',
    duration: 15,
    videoResolution: '1080p',
    generateAudio: true,
  },
  'google/veo-3.1-lite-generate-001': {
    aspect: '9:16',
    duration: 6,
    videoResolution: '1080p',
    generateAudio: true,
  },
  'google/veo-3.1-fast-generate-001': {
    aspect: '16:9',
    duration: 4,
    videoResolution: '4k',
    generateAudio: false,
  },
  'google/veo-3.1-generate-001': {
    aspect: '9:16',
    duration: 8,
    videoResolution: '4k',
    generateAudio: true,
  },
} as const;

describe('Studio video contract matrix', () => {
  it('accepts every configured model at its provider limits', () => {
    for (const modelId of STUDIO_VIDEO_MODEL_IDS) {
      const request = normalizeStudioVideoRequest({
        modelId,
        parameters: VALID_PARAMETERS[modelId],
      });
      assert.equal(request.modelId, modelId);
      assert.equal(
        request.videoResolution,
        VALID_PARAMETERS[modelId].videoResolution,
      );
    }
  });

  it('rejects models and parameter combinations outside the allowlist', () => {
    assert.throws(
      () =>
        normalizeStudioVideoRequest({
          modelId: 'bytedance/seedance-2.0',
          parameters: {},
        }),
      VideoGenerationValidationError,
    );
    assert.throws(
      () =>
        normalizeStudioVideoRequest({
          modelId: 'bytedance/seedance-2.5',
          parameters: { duration: 31 },
        }),
      /between 4 and 30/,
    );
    assert.throws(
      () =>
        normalizeStudioVideoRequest({
          modelId: 'minimax/minimax-h3',
          parameters: { videoResolution: '1080p' },
        }),
      /supports these resolutions: 2k/,
    );
    assert.throws(
      () =>
        normalizeStudioVideoRequest({
          modelId: 'google/veo-3.1-fast-generate-001',
          parameters: { duration: 5 },
        }),
      /one of: 4, 6, 8/,
    );
    assert.throws(
      () =>
        normalizeStudioVideoRequest({
          modelId: 'google/veo-3.1-generate-001',
          parameters: { aspect: '1:1' },
        }),
      /16:9, 9:16/,
    );
  });

  it('accepts nested parameters first and rejects unknown parameter names', () => {
    assert.deepEqual(
      videoParametersFromBody({
        duration: 4,
        videoResolution: '720p',
        parameters: { duration: 8, generateAudio: true },
      }),
      {
        aspect: undefined,
        duration: 8,
        videoResolution: '720p',
        generateAudio: true,
      },
    );
    assert.throws(
      () => videoParametersFromBody({ parameters: { quality: 'high' } }),
      /Unsupported video parameter: quality/,
    );
    assert.throws(
      () =>
        normalizeStudioVideoRequest({
          modelId: 'bytedance/seedance-2.5',
          parameters: videoParametersFromBody({
            duration: 5,
            parameters: { duration: null },
          }),
        }),
      /whole number of seconds/,
    );
  });

  it('rejects ambiguous or multiple reference images', () => {
    assert.equal(
      videoReferenceFromBody({
        refSrcs: ['https://cdn.example.com/reference.png'],
      }),
      'https://cdn.example.com/reference.png',
    );
    assert.throws(
      () =>
        videoReferenceFromBody({
          refSrcs: ['https://cdn.example.com/one.png', 'two.png'],
        }),
      /one reference image/,
    );
    assert.throws(
      () =>
        videoReferenceFromBody({
          refSrc: 'https://cdn.example.com/one.png',
          refSrcs: ['https://cdn.example.com/two.png'],
        }),
      /reference image once/,
    );
  });
});

describe('Studio video Gateway payload', () => {
  it('sends Seedance audio at the top level and never in providerOptions', () => {
    const request = normalizeStudioVideoRequest({
      modelId: 'bytedance/seedance-2.5',
      parameters: {
        aspect: '16:9',
        duration: 5,
        videoResolution: '720p',
        generateAudio: true,
      },
      referenceImage: 'https://cdn.example.com/first-frame.png',
    });
    const payload = buildStudioVideoGeneratePayload({
      prompt: 'Slow dolly forward.',
      request,
    });

    assert.deepEqual(payload, {
      model: 'bytedance/seedance-2.5',
      prompt: {
        image: 'https://cdn.example.com/first-frame.png',
        text: 'Slow dolly forward.',
      },
      aspectRatio: 'adaptive',
      duration: 5,
      resolution: '1280x720',
      generateAudio: true,
      maxRetries: 0,
    });
    assert.equal('providerOptions' in payload, false);
  });

  it('uses the exact 2K and 4K Gateway pixel dimensions', () => {
    const minimax = normalizeStudioVideoRequest({
      modelId: 'minimax/minimax-h3',
      parameters: {},
    });
    const veo = normalizeStudioVideoRequest({
      modelId: 'google/veo-3.1-fast-generate-001',
      parameters: { videoResolution: '4k' },
    });

    assert.equal(minimax.resolution, '2048x2048');
    assert.equal(veo.resolution, '3840x2160');
  });

  it('enforces each provider reference source contract', () => {
    assert.throws(
      () =>
        normalizeStudioVideoRequest({
          modelId: 'bytedance/seedance-2.5',
          parameters: {},
          referenceImage: 'data:image/png;base64,AAAA',
        }),
      /requires a URL reference image/,
    );
    assert.doesNotThrow(() =>
      normalizeStudioVideoRequest({
        modelId: 'xai/grok-imagine-video-1.5',
        parameters: {},
        referenceImage: 'data:image/png;base64,AAAA',
      }),
    );
    assert.throws(
      () =>
        normalizeStudioVideoRequest({
          modelId: 'google/veo-3.1-lite-generate-001',
          parameters: {},
          referenceImage: 'https://cdn.example.com/reference.png',
        }),
      /does not support reference-image generation/,
    );
  });

  it('matches pixel dimensions to portrait aspects and supports adaptive Seedance input', () => {
    const portraitSeedance = normalizeStudioVideoRequest({
      modelId: 'bytedance/seedance-2.5',
      parameters: { aspect: '9:16', videoResolution: '720p' },
    });
    const portraitVeo = normalizeStudioVideoRequest({
      modelId: 'google/veo-3.1-fast-generate-001',
      parameters: { aspect: '9:16', videoResolution: '4k' },
    });
    const adaptiveSeedance = normalizeStudioVideoRequest({
      modelId: 'bytedance/seedance-2.5',
      parameters: { aspect: 'adaptive', videoResolution: '720p' },
      referenceImage: 'https://cdn.example.com/reference.png',
    });

    assert.equal(portraitSeedance.resolution, '720x1280');
    assert.equal(portraitVeo.resolution, '2160x3840');
    assert.equal(adaptiveSeedance.aspect, 'adaptive');
    assert.equal(adaptiveSeedance.resolution, '1280x720');
    assert.throws(
      () =>
        normalizeStudioVideoRequest({
          modelId: 'bytedance/seedance-2.5',
          parameters: { aspect: 'adaptive' },
        }),
      /requires a reference image/,
    );
  });
});

describe('Studio video upstream pricing', () => {
  it('prices Seedance from aggregate video tokens with one upward rounding', () => {
    const preview = normalizeStudioVideoRequest({
      modelId: 'bytedance/seedance-2.5',
      parameters: {
        aspect: '16:9',
        duration: 4,
        videoResolution: '480p',
      },
    });
    const landscape = normalizeStudioVideoRequest({
      modelId: 'bytedance/seedance-2.5',
      parameters: {
        aspect: '16:9',
        duration: 5,
        videoResolution: '720p',
      },
    });
    const adaptive = normalizeStudioVideoRequest({
      modelId: 'bytedance/seedance-2.5',
      parameters: {
        aspect: '16:9',
        duration: 5,
        videoResolution: '720p',
      },
      hasReferenceImage: true,
    });
    const fullHd = normalizeStudioVideoRequest({
      modelId: 'bytedance/seedance-2.5',
      parameters: {
        aspect: '16:9',
        duration: 4,
        videoResolution: '1080p',
        generateAudio: true,
      },
    });

    assert.equal(estimateStudioVideoUpstreamUsdMicros(preview), 411_201);
    assert.equal(estimateStudioVideoUpstreamUsdMicros(landscape), 1_155_600);
    // Adaptive preauthorization uses the 5:2 maximum input ratio. The exact
    // aggregate is 1,625,062.5 USD micros, rounded once to 1,625,063.
    assert.equal(estimateStudioVideoUpstreamUsdMicros(adaptive), 1_625_063);
    assert.equal(estimateStudioVideoUpstreamUsdMicros(fullHd), 2_274_480);
  });

  it('prices every duration/audio/resolution tier from the Gateway matrix', () => {
    const cases = [
      ['minimax/minimax-h3', '2k', 5, false, 650_000],
      ['xai/grok-imagine-video-1.5', '480p', 1, false, 80_000],
      ['xai/grok-imagine-video-1.5', '720p', 1, true, 140_000],
      ['xai/grok-imagine-video-1.5', '1080p', 1, true, 250_000],
      ['google/veo-3.1-lite-generate-001', '720p', 4, false, 120_000],
      ['google/veo-3.1-lite-generate-001', '720p', 4, true, 200_000],
      ['google/veo-3.1-lite-generate-001', '1080p', 4, false, 200_000],
      ['google/veo-3.1-lite-generate-001', '1080p', 4, true, 320_000],
      ['google/veo-3.1-fast-generate-001', '720p', 4, false, 400_000],
      ['google/veo-3.1-fast-generate-001', '720p', 4, true, 600_000],
      ['google/veo-3.1-fast-generate-001', '1080p', 4, false, 400_000],
      ['google/veo-3.1-fast-generate-001', '1080p', 4, true, 600_000],
      ['google/veo-3.1-fast-generate-001', '4k', 4, false, 1_200_000],
      ['google/veo-3.1-fast-generate-001', '4k', 4, true, 1_400_000],
      ['google/veo-3.1-generate-001', '720p', 4, false, 800_000],
      ['google/veo-3.1-generate-001', '720p', 4, true, 1_600_000],
      ['google/veo-3.1-generate-001', '1080p', 4, false, 800_000],
      ['google/veo-3.1-generate-001', '1080p', 4, true, 1_600_000],
      ['google/veo-3.1-generate-001', '4k', 4, false, 1_600_000],
      ['google/veo-3.1-generate-001', '4k', 4, true, 2_400_000],
    ] as const;

    for (const [
      modelId,
      videoResolution,
      duration,
      generateAudio,
      expected,
    ] of cases) {
      const request = normalizeStudioVideoRequest({
        modelId,
        parameters: {
          duration,
          videoResolution,
          generateAudio,
        },
      });
      assert.equal(
        estimateStudioVideoUpstreamUsdMicros(request),
        expected,
        `${modelId} ${videoResolution} audio=${generateAudio}`,
      );
    }
  });

  it('applies product markup after aggregating the upstream clip charge', () => {
    const request = normalizeStudioVideoRequest({
      modelId: 'bytedance/seedance-2.5',
      parameters: {
        aspect: '16:9',
        duration: 5,
        videoResolution: '720p',
      },
    });
    const upstreamUsdMicros =
      estimateStudioVideoUpstreamUsdMicros(request);

    assert.deepEqual(
      priceStudioUsage({ modelId: request.modelId, upstreamUsdMicros }),
      {
        credits: 174,
        upstreamUsdMicros: 1_155_600,
        markupBps: 15_000,
        pricingVersion: '2026-08-25.v2',
      },
    );
  });
});
