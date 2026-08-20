import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_STUDIO_AGENT_MODEL_ID,
  MIN_STUDIO_MARKUP_BPS,
  STUDIO_PRICING_VERSION,
  estimateStudioAgentInputTokenReserve,
  estimateStudioCredits,
  estimateStudioLanguageUpstreamUsdMicros,
  expectedStudioCreditsStatus,
  normalizeStudioRuntimeConfig,
  priceStudioUsage,
  resolveStudioAgentModelId,
  StudioModelDisabledError,
} from './pricing';

test('normalizes malformed policy values and enforces the markup floor', () => {
  const runtime = normalizeStudioRuntimeConfig({
    agentModelId: 'not/a-model',
    modelPolicy: {
      'xai/grok-imagine-image-2.0': {
        enabled: false,
        markupBps: 1,
        minimumCredits: -20,
      },
      'unknown/model': { enabled: true, markupBps: 99_999 },
    },
    pricingVersion: 'attacker-controlled',
  });

  assert.equal(runtime.agentModelId, DEFAULT_STUDIO_AGENT_MODEL_ID);
  assert.deepEqual(runtime.modelPolicy['xai/grok-imagine-image-2.0'], {
    enabled: false,
    markupBps: MIN_STUDIO_MARKUP_BPS,
    minimumCredits: 1,
  });
  assert.equal(runtime.pricingVersion, STUDIO_PRICING_VERSION);
  assert.equal('unknown/model' in runtime.modelPolicy, false);
});

test('accepts JSON policy flags and keeps the old boolean input harmless', () => {
  const json = JSON.stringify({
    'openai/gpt-5.6-sol': { markupBps: 17_500, minimumCredits: 9 },
  });
  const runtime = normalizeStudioRuntimeConfig(json);
  assert.equal(runtime.modelPolicy['openai/gpt-5.6-sol'].markupBps, 17_500);
  assert.equal(runtime.modelPolicy['openai/gpt-5.6-sol'].minimumCredits, 9);
  assert.equal(
    normalizeStudioRuntimeConfig(true).legacyFreeCreditModelsOnly,
    true,
  );
  assert.equal(
    normalizeStudioRuntimeConfig(true).modelPolicy[
      'deepseek/deepseek-v4-flash'
    ].enabled,
    true,
  );
});

test('falls back to DeepSeek when the requested Agent model is invalid or disabled', () => {
  const runtime = normalizeStudioRuntimeConfig({
    modelPolicy: {
      'openai/gpt-5.6-sol': { enabled: false },
    },
  });
  assert.equal(
    resolveStudioAgentModelId('openai/gpt-5.6-sol', runtime),
    DEFAULT_STUDIO_AGENT_MODEL_ID,
  );
  assert.equal(
    resolveStudioAgentModelId('invalid/model', runtime),
    DEFAULT_STUDIO_AGENT_MODEL_ID,
  );
});

test('falls back to the first enabled Agent when DeepSeek is disabled', () => {
  const runtime = normalizeStudioRuntimeConfig({
    agentModelId: 'openai/gpt-5.6-sol',
    modelPolicy: {
      'deepseek/deepseek-v4-flash': { enabled: false },
      'openai/gpt-5.6-sol': { enabled: false },
    },
  });
  assert.equal(runtime.agentModelId, 'openai/gpt-5.6-luna');
  assert.equal(
    resolveStudioAgentModelId('openai/gpt-5.6-sol', runtime),
    'openai/gpt-5.6-luna',
  );
});

test('rounds only after applying aggregate markup and respects minimum credits', () => {
  const runtime = normalizeStudioRuntimeConfig({
    modelPolicy: {
      'minimax/minimax-h3': { markupBps: 15_000, minimumCredits: 2 },
    },
  });
  assert.deepEqual(
    priceStudioUsage({
      modelId: 'minimax/minimax-h3',
      upstreamUsdMicros: 10_001,
      runtime,
    }),
    {
      credits: 2,
      upstreamUsdMicros: 10_001,
      markupBps: 15_000,
      pricingVersion: STUDIO_PRICING_VERSION,
    },
  );
  assert.equal(
    priceStudioUsage({
      modelId: 'minimax/minimax-h3',
      upstreamUsdMicros: 20_001,
      runtime,
    }).credits,
    4,
  );
});

test('refuses to quote disabled models', () => {
  const runtime = normalizeStudioRuntimeConfig({
    modelPolicy: {
      'google/veo-3.1-generate-001': { enabled: false },
    },
  });
  assert.throws(
    () =>
      priceStudioUsage({
        modelId: 'google/veo-3.1-generate-001',
        upstreamUsdMicros: 1_000_000,
        runtime,
      }),
    StudioModelDisabledError,
  );
});

test('quotes the same parameter-sensitive image and video reserves used by routes', () => {
  assert.deepEqual(
    estimateStudioCredits({
      kind: 'image',
      modelId: 'xai/grok-imagine-image-2.0',
      parameters: {
        aspect: '1:1',
        n: 1,
        quality: 'medium',
        resolution: '1k',
      },
    }),
    {
      credits: 9,
      upstreamUsdMicros: 60_000,
      markupBps: 15_000,
      pricingVersion: STUDIO_PRICING_VERSION,
    },
  );
  assert.equal(
    estimateStudioCredits({
      kind: 'video',
      modelId: 'google/veo-3.1-fast-generate-001',
      parameters: {
        aspect: '16:9',
        duration: 8,
        videoResolution: '4k',
        generateAudio: true,
      },
    }).credits,
    420,
  );
});

test('detects stale client quotes before a route debits credits', () => {
  const quote = priceStudioUsage({
    modelId: 'xai/grok-imagine-image-2.0',
    upstreamUsdMicros: 60_000,
  });
  assert.equal(expectedStudioCreditsStatus(undefined, quote), 'not-provided');
  assert.equal(expectedStudioCreditsStatus('9', quote), 'invalid');
  assert.equal(expectedStudioCreditsStatus(9, quote), 'match');
  assert.equal(expectedStudioCreditsStatus(8, quote), 'changed');
});

test('reserves the bounded Agent context across every tool-loop step', () => {
  assert.equal(
    estimateStudioAgentInputTokenReserve({
      requestBytes: 64_000,
      hasSkills: false,
    }),
    768_000,
  );
  assert.equal(
    estimateStudioAgentInputTokenReserve({
      requestBytes: 64_000,
      hasSkills: true,
    }),
    1_608_000,
  );
});

test('applies Gateway long-context language tiers to a single model call', () => {
  assert.equal(
    estimateStudioLanguageUpstreamUsdMicros({
      modelId: 'google/gemini-3.1-pro-preview',
      inputTokens: 200_000,
      outputTokens: 1_000,
    }),
    412_000,
  );
  assert.equal(
    estimateStudioLanguageUpstreamUsdMicros({
      modelId: 'google/gemini-3.1-pro-preview',
      inputTokens: 200_001,
      outputTokens: 1_000,
    }),
    818_004,
  );
});
