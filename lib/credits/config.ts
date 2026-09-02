import {
  DEFAULT_STUDIO_RUNTIME_CONFIG,
  STUDIO_AGENT_MAX_OUTPUT_TOKENS_PER_STEP,
  estimateStudioLanguageUpstreamUsdMicros,
  estimateStudioCredits,
  priceStudioUsage,
} from '@/lib/studio/pricing';
import { STUDIO_MODELS } from '@/lib/studio/model-catalog';

export const WELCOME_CREDITS = 120;

export type MeteredAiKind = 'agent' | 'text' | 'image' | 'video';

function creditsFor(
  kind: 'image' | 'video' | 'text',
  parameters: Record<string, unknown>,
) {
  return estimateStudioCredits({
    kind,
    modelId: STUDIO_MODELS[kind].id as never,
    parameters,
    prompt: 'Estimate',
    runtime: DEFAULT_STUDIO_RUNTIME_CONFIG,
  }).credits;
}

/**
 * What the Credits page quotes. Every figure is the real quote for that kind's
 * default model at its default settings, so the page describes what a reader
 * gets if they change nothing — the numbers used to be typed by hand and had
 * drifted to 8x off on text and to rates no model charged on video.
 */
function defaultCosts() {
  const video = STUDIO_MODELS.video;
  const seconds = Number(video.defaults.duration) || 8;
  const clip = creditsFor('video', video.defaults);
  return {
    // One Agent step: the fixed input reserve plus a full output allowance.
    agent: priceStudioUsage({
      modelId: DEFAULT_STUDIO_RUNTIME_CONFIG.agentModelId,
      upstreamUsdMicros: estimateStudioLanguageUpstreamUsdMicros({
        modelId: DEFAULT_STUDIO_RUNTIME_CONFIG.agentModelId,
        inputTokens: 32_000,
        outputTokens: STUDIO_AGENT_MAX_OUTPUT_TOKENS_PER_STEP,
      }),
      runtime: DEFAULT_STUDIO_RUNTIME_CONFIG,
    }).credits,
    text: creditsFor('text', STUDIO_MODELS.text.defaults),
    image: creditsFor('image', { ...STUDIO_MODELS.image.defaults, n: 1 }),
    videoPerSecond: Math.max(1, Math.round(clip / seconds)),
    videoClip: clip,
    videoClipSeconds: seconds,
    videoModelLabel: video.label,
    videoResolution: String(video.defaults.videoResolution ?? ''),
  };
}

export const CREDIT_COSTS = defaultCosts();

export function imageCreditCost(count: number) {
  return CREDIT_COSTS.image * Math.min(4, Math.max(1, Math.round(count)));
}
