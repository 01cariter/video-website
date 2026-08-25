import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_STUDIO_AGENT_MODEL_ID,
  MIN_STUDIO_MARKUP_BPS,
  FAIL_CLOSED_STUDIO_MODEL_POLICY,
  STUDIO_AGENT_GATEWAY_PROVIDER_BY_MODEL,
  STUDIO_PRICING_VERSION,
  estimateStudioAgentInputTokenReserve,
  estimateStudioCredits,
  estimateStudioInterruptedAgentStepUsage,
  estimateStudioLanguageUpstreamUsdMicros,
  expectedStudioCreditsStatus,
  normalizeStudioRuntimeConfig,
  priceStudioUsage,
  resolveStudioAgentModelId,
  studioAgentModelForInput,
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
  assert.deepEqual(
    runtime.modelPolicy['spacexai/grok-imagine-image-2.0'],
    {
    enabled: false,
    markupBps: MIN_STUDIO_MARKUP_BPS,
    minimumCredits: 1,
    upstreamRateBps: 10_000,
    creditMode: 'cost-plus',
    fixedCredits: 1,
    },
  );
  assert.equal(runtime.pricingVersion, STUDIO_PRICING_VERSION);
  assert.equal('unknown/model' in runtime.modelPolicy, false);
});

test('accepts JSON policy flags with a safe configurable credit formula', () => {
  const json = JSON.stringify({
    'openai/gpt-5.6-sol': {
      markupBps: 17_500,
      minimumCredits: 9,
      upstreamRateBps: 12_500,
      creditMode: 'fixed-floor',
      fixedCredits: 40,
    },
  });
  const runtime = normalizeStudioRuntimeConfig(json);
  assert.equal(runtime.modelPolicy['openai/gpt-5.6-sol'].markupBps, 17_500);
  assert.equal(runtime.modelPolicy['openai/gpt-5.6-sol'].minimumCredits, 9);
  assert.equal(runtime.modelPolicy['openai/gpt-5.6-sol'].upstreamRateBps, 12_500);
  assert.equal(runtime.modelPolicy['openai/gpt-5.6-sol'].creditMode, 'fixed-floor');
  assert.equal(runtime.modelPolicy['openai/gpt-5.6-sol'].fixedCredits, 40);
});

test('fails closed when the model-policy flag cannot be read', () => {
  const runtime = normalizeStudioRuntimeConfig({
    modelPolicy: FAIL_CLOSED_STUDIO_MODEL_POLICY,
  });
  assert.equal(
    Object.values(runtime.modelPolicy).every((policy) => !policy.enabled),
    true,
  );
});

test('pins every Agent model to the provider covered by its price table', () => {
  assert.deepEqual(STUDIO_AGENT_GATEWAY_PROVIDER_BY_MODEL, {
    'deepseek/deepseek-v4-flash': 'deepinfra',
    'openai/gpt-5.6-luna': 'openai',
    'openai/gpt-5.6-terra': 'openai',
    'openai/gpt-5.6-sol': 'openai',
    'anthropic/claude-sonnet-5': 'anthropic',
    'google/gemini-3.1-pro-preview': 'google',
  });
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

test('routes image context to the cheapest enabled vision-capable Agent', () => {
  const runtime = normalizeStudioRuntimeConfig({
    agentModelId: 'deepseek/deepseek-v4-flash',
  });
  assert.equal(
    studioAgentModelForInput(runtime, false),
    'deepseek/deepseek-v4-flash',
  );
  assert.equal(
    studioAgentModelForInput(runtime, true),
    'openai/gpt-5.6-luna',
  );

  const withoutLuna = normalizeStudioRuntimeConfig({
    agentModelId: 'deepseek/deepseek-v4-flash',
    modelPolicy: { 'openai/gpt-5.6-luna': { enabled: false } },
  });
  assert.equal(
    studioAgentModelForInput(withoutLuna, true),
    'openai/gpt-5.6-terra',
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

test('fixed-floor pricing remains above the sustainable cost floor', () => {
  const runtime = normalizeStudioRuntimeConfig({
    modelPolicy: {
      'minimax/minimax-h3': {
        creditMode: 'fixed-floor',
        fixedCredits: 7,
      },
    },
  });
  assert.equal(
    priceStudioUsage({
      modelId: 'minimax/minimax-h3',
      upstreamUsdMicros: 1_000_000,
      runtime,
    }).credits,
    125,
  );
});

test('a flag can raise a model rate immediately but cannot undercut its official baseline', () => {
  const raised = normalizeStudioRuntimeConfig({
    modelPolicy: {
      'minimax/minimax-h3': { upstreamRateBps: 20_000 },
    },
  });
  const undercut = normalizeStudioRuntimeConfig({
    modelPolicy: {
      'minimax/minimax-h3': { upstreamRateBps: 1 },
    },
  });
  assert.equal(
    priceStudioUsage({
      modelId: 'minimax/minimax-h3',
      upstreamUsdMicros: 100_000,
      runtime: raised,
    }).upstreamUsdMicros,
    200_000,
  );
  assert.equal(
    undercut.modelPolicy['minimax/minimax-h3'].upstreamRateBps,
    10_000,
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
      modelId: 'spacexai/grok-imagine-image-2.0',
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
    modelId: 'spacexai/grok-imagine-image-2.0',
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

test('bounds a partially streamed aborted Agent step without charging all steps', () => {
  assert.deepEqual(
    estimateStudioInterruptedAgentStepUsage({
      reservedInputTokens: 768_000,
      streamedOutputBytes: 9_000,
    }),
    { inputTokens: 96_000, outputTokens: 2_048 },
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
