import {
  prepareStudioImageRequest,
  STUDIO_IMAGE_MODEL_IDS,
  type StudioImageModelId,
} from './image-generation';
import {
  estimateStudioVideoUpstreamUsdMicros,
  normalizeStudioVideoRequest,
  STUDIO_VIDEO_MODEL_IDS,
  type StudioVideoModelId,
} from './video-generation';
import type { StudioGenerativeKind } from './types';

export const STUDIO_AGENT_MODEL_IDS = [
  'deepseek/deepseek-v4-flash',
  'openai/gpt-5.6-luna',
  'openai/gpt-5.6-terra',
  'openai/gpt-5.6-sol',
  'anthropic/claude-sonnet-5',
  'google/gemini-3.1-pro-preview',
] as const;

export type StudioAgentModelId = (typeof STUDIO_AGENT_MODEL_IDS)[number];
export type StudioTextModelId = StudioAgentModelId;
export type StudioBillableModelId =
  | StudioAgentModelId
  | StudioImageModelId
  | StudioVideoModelId;

export const DEFAULT_STUDIO_AGENT_MODEL_ID: StudioAgentModelId =
  'deepseek/deepseek-v4-flash';
export const STUDIO_PRICING_VERSION = '2026-08-20.v1';
export const DEFAULT_STUDIO_MARKUP_BPS = 15_000;
export const MIN_STUDIO_MARKUP_BPS = 12_500;
export const USD_MICROS_PER_CREDIT = 10_000;
export const STUDIO_AGENT_MAX_STEPS = 8;
export const STUDIO_AGENT_MAX_OUTPUT_TOKENS_PER_STEP = 2_048;
export const STUDIO_AGENT_SKILL_CONTEXT_BYTE_LIMIT = 120_000;

const STUDIO_AGENT_FIXED_INPUT_TOKEN_RESERVE = 256_000;
const MAX_STUDIO_AGENT_REQUEST_BYTES = 64_000;

const MAX_STUDIO_MARKUP_BPS = 1_000_000;
const MAX_MINIMUM_CREDITS = 1_000_000;

export const STUDIO_BILLABLE_MODEL_IDS = [
  ...STUDIO_AGENT_MODEL_IDS,
  ...STUDIO_IMAGE_MODEL_IDS,
  ...STUDIO_VIDEO_MODEL_IDS,
] as const satisfies readonly StudioBillableModelId[];

export interface StudioModelPolicyOverride {
  enabled?: boolean;
  markupBps?: number;
  minimumCredits?: number;
}

export interface StudioResolvedModelPolicy {
  enabled: boolean;
  markupBps: number;
  minimumCredits: number;
}

export type StudioModelPolicy = Record<
  StudioBillableModelId,
  StudioResolvedModelPolicy
>;

/** Serializable server-to-client configuration. Official model contracts and
 * upstream prices stay in code; the JSON flag only supplies policy overrides. */
export interface StudioRuntimeConfig {
  agentModelId: StudioAgentModelId;
  modelPolicy: StudioModelPolicy;
  pricingVersion: typeof STUDIO_PRICING_VERSION;
  /** Kept while older pages still pass the former boolean flag. Gateway's
   * account credit is not a model capability, so this does not filter models. */
  legacyFreeCreditModelsOnly: boolean;
}

export interface StudioPriceQuote {
  credits: number;
  upstreamUsdMicros: number;
  markupBps: number;
  pricingVersion: typeof STUDIO_PRICING_VERSION;
}

export type StudioExpectedCreditsStatus =
  | 'not-provided'
  | 'invalid'
  | 'match'
  | 'changed';

export interface EstimateStudioCreditsInput {
  kind: StudioGenerativeKind;
  modelId: StudioBillableModelId;
  parameters?: Record<string, unknown>;
  prompt?: string;
  current?: string;
  referenceImages?: string[];
  runtime?: StudioRuntimeConfig;
}

const LANGUAGE_TOKEN_RATES_USD_MICROS_PER_MILLION: Record<
  StudioAgentModelId,
  {
    input: number;
    output: number;
    longContext?: { threshold: number; input: number; output: number };
  }
> = {
  'deepseek/deepseek-v4-flash': { input: 130_000, output: 260_000 },
  'openai/gpt-5.6-luna': {
    input: 200_000,
    output: 1_200_000,
    longContext: { threshold: 272_000, input: 400_000, output: 1_800_000 },
  },
  'openai/gpt-5.6-terra': {
    input: 2_000_000,
    output: 12_000_000,
    longContext: {
      threshold: 272_000,
      input: 4_000_000,
      output: 18_000_000,
    },
  },
  'openai/gpt-5.6-sol': {
    input: 2_500_000,
    output: 15_000_000,
    longContext: {
      threshold: 272_000,
      input: 5_000_000,
      output: 22_500_000,
    },
  },
  'anthropic/claude-sonnet-5': { input: 2_000_000, output: 10_000_000 },
  'google/gemini-3.1-pro-preview': {
    input: 2_000_000,
    output: 12_000_000,
    longContext: {
      threshold: 200_001,
      input: 4_000_000,
      output: 18_000_000,
    },
  },
};

export class StudioModelDisabledError extends Error {
  constructor(modelId: string) {
    super(`Studio model is disabled: ${modelId}`);
    this.name = 'StudioModelDisabledError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function safeInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function isStudioAgentModelId(
  value: unknown,
): value is StudioAgentModelId {
  return (
    typeof value === 'string' &&
    STUDIO_AGENT_MODEL_IDS.some((modelId) => modelId === value)
  );
}

export function isStudioBillableModelId(
  value: unknown,
): value is StudioBillableModelId {
  return (
    typeof value === 'string' &&
    STUDIO_BILLABLE_MODEL_IDS.some((modelId) => modelId === value)
  );
}

function resolvedPolicy(value: unknown): StudioResolvedModelPolicy {
  const override = isRecord(value) ? value : {};
  return {
    enabled:
      typeof override.enabled === 'boolean' ? override.enabled : true,
    markupBps: safeInteger(
      override.markupBps,
      DEFAULT_STUDIO_MARKUP_BPS,
      MIN_STUDIO_MARKUP_BPS,
      MAX_STUDIO_MARKUP_BPS,
    ),
    minimumCredits: safeInteger(
      override.minimumCredits,
      1,
      1,
      MAX_MINIMUM_CREDITS,
    ),
  };
}

function normalizePolicy(raw: unknown): StudioModelPolicy {
  const record = parseJsonRecord(raw) ?? {};
  return Object.fromEntries(
    STUDIO_BILLABLE_MODEL_IDS.map((modelId) => [
      modelId,
      resolvedPolicy(record[modelId]),
    ]),
  ) as StudioModelPolicy;
}

function firstEnabledAgentModel(modelPolicy: StudioModelPolicy) {
  if (modelPolicy[DEFAULT_STUDIO_AGENT_MODEL_ID].enabled) {
    return DEFAULT_STUDIO_AGENT_MODEL_ID;
  }
  return (
    STUDIO_AGENT_MODEL_IDS.find((modelId) => modelPolicy[modelId].enabled) ??
    DEFAULT_STUDIO_AGENT_MODEL_ID
  );
}

/** Accepts the new runtime object, a raw JSON policy flag, or the former
 * boolean flag. Unknown ids and malformed values never escape this boundary. */
export function normalizeStudioRuntimeConfig(
  value?: unknown,
): StudioRuntimeConfig {
  const legacyFreeCreditModelsOnly =
    typeof value === 'boolean'
      ? value
      : isRecord(value) && typeof value.freeCreditModelsOnly === 'boolean'
        ? value.freeCreditModelsOnly
        : isRecord(value) &&
            typeof value.legacyFreeCreditModelsOnly === 'boolean'
          ? value.legacyFreeCreditModelsOnly
          : false;
  const record = parseJsonRecord(value);
  const rawPolicy = record?.modelPolicy ?? record?.policy ?? record ?? {};
  const modelPolicy = normalizePolicy(rawPolicy);
  const requestedAgentModel = record?.agentModelId;
  const agentModelId =
    isStudioAgentModelId(requestedAgentModel) &&
    modelPolicy[requestedAgentModel].enabled
      ? requestedAgentModel
      : firstEnabledAgentModel(modelPolicy);

  return {
    agentModelId,
    modelPolicy,
    pricingVersion: STUDIO_PRICING_VERSION,
    legacyFreeCreditModelsOnly,
  };
}

export const DEFAULT_STUDIO_RUNTIME_CONFIG: StudioRuntimeConfig =
  normalizeStudioRuntimeConfig();

export function resolveStudioAgentModelId(
  requested: unknown,
  runtime: StudioRuntimeConfig = DEFAULT_STUDIO_RUNTIME_CONFIG,
): StudioAgentModelId {
  return isStudioAgentModelId(requested) && runtime.modelPolicy[requested].enabled
    ? requested
    : firstEnabledAgentModel(runtime.modelPolicy);
}

export function isStudioModelEnabled(
  modelId: unknown,
  runtime: StudioRuntimeConfig = DEFAULT_STUDIO_RUNTIME_CONFIG,
): modelId is StudioBillableModelId {
  return (
    isStudioBillableModelId(modelId) && runtime.modelPolicy[modelId].enabled
  );
}

/** Applies product markup after a provider-specific helper has calculated the
 * upstream charge. One credit has a $0.01 face value (10,000 USD micros). */
export function priceStudioUsage(input: {
  modelId: StudioBillableModelId;
  upstreamUsdMicros: number;
  runtime?: StudioRuntimeConfig;
}): StudioPriceQuote {
  const runtime = input.runtime ?? DEFAULT_STUDIO_RUNTIME_CONFIG;
  const policy = runtime.modelPolicy[input.modelId];
  if (!policy?.enabled) throw new StudioModelDisabledError(input.modelId);

  const upstreamUsdMicros = safeInteger(
    input.upstreamUsdMicros,
    0,
    0,
    Number.MAX_SAFE_INTEGER / MAX_STUDIO_MARKUP_BPS,
  );
  const credits = Math.max(
    policy.minimumCredits,
    Math.ceil(
      (upstreamUsdMicros * policy.markupBps) /
        (10_000 * USD_MICROS_PER_CREDIT),
    ),
  );

  return {
    credits,
    upstreamUsdMicros,
    markupBps: policy.markupBps,
    pricingVersion: runtime.pricingVersion,
  };
}

export function expectedStudioCreditsStatus(
  expected: unknown,
  quote: StudioPriceQuote,
): StudioExpectedCreditsStatus {
  if (expected === undefined || expected === null) return 'not-provided';
  if (
    typeof expected !== 'number' ||
    !Number.isInteger(expected) ||
    expected < 1
  ) {
    return 'invalid';
  }
  return expected === quote.credits ? 'match' : 'changed';
}

export function estimateStudioLanguageUpstreamUsdMicros(input: {
  modelId: StudioAgentModelId;
  inputTokens: number;
  outputTokens: number;
}) {
  const rates = LANGUAGE_TOKEN_RATES_USD_MICROS_PER_MILLION[input.modelId];
  const inputTokens = Math.max(0, Math.ceil(input.inputTokens));
  const outputTokens = Math.max(0, Math.ceil(input.outputTokens));
  const activeRates =
    rates.longContext && inputTokens >= rates.longContext.threshold
      ? rates.longContext
      : rates;
  return Math.ceil(
    (inputTokens * activeRates.input + outputTokens * activeRates.output) /
      1_000_000,
  );
}

/** Bounds repeated user/canvas context, tool schemas and results, plus the
 * request-scoped Skill context limit across the complete tool loop. UTF-8 BPE
 * token counts cannot exceed the serialized byte count used by this bound. */
export function estimateStudioAgentInputTokenReserve(input: {
  requestBytes: number;
  hasSkills: boolean;
}) {
  const requestBytes = safeInteger(
    input.requestBytes,
    0,
    0,
    MAX_STUDIO_AGENT_REQUEST_BYTES,
  );
  return (
    requestBytes * STUDIO_AGENT_MAX_STEPS +
    STUDIO_AGENT_FIXED_INPUT_TOKEN_RESERVE +
    (input.hasSkills
      ? STUDIO_AGENT_SKILL_CONTEXT_BYTE_LIMIT *
        (STUDIO_AGENT_MAX_STEPS - 1)
      : 0)
  );
}

/** Produces the exact deterministic pre-authorization used by Studio routes.
 * Provider usage that is unknowable before execution is conservatively
 * reserved by the model-specific helpers. */
export function estimateStudioCredits(
  input: EstimateStudioCreditsInput,
): StudioPriceQuote {
  const runtime = input.runtime ?? DEFAULT_STUDIO_RUNTIME_CONFIG;
  const parameters = input.parameters ?? {};
  const referenceImages = input.referenceImages ?? [];
  const prompt = input.prompt?.trim() || 'Generation preview';
  let upstreamUsdMicros: number;

  if (input.kind === 'image') {
    if (!STUDIO_IMAGE_MODEL_IDS.some((modelId) => modelId === input.modelId)) {
      throw new Error('Unsupported image model.');
    }
    upstreamUsdMicros = prepareStudioImageRequest({
      modelId: input.modelId,
      prompt,
      parameters,
      referenceImages,
    }).upstreamUsdMicros;
  } else if (input.kind === 'video') {
    if (!STUDIO_VIDEO_MODEL_IDS.some((modelId) => modelId === input.modelId)) {
      throw new Error('Unsupported video model.');
    }
    const request = normalizeStudioVideoRequest({
      modelId: input.modelId,
      parameters,
      referenceImage: referenceImages[0],
      hasReferenceImage: referenceImages.length > 0,
    });
    upstreamUsdMicros = estimateStudioVideoUpstreamUsdMicros(request);
  } else {
    if (!isStudioAgentModelId(input.modelId)) {
      throw new Error('Unsupported text model.');
    }
    const effort =
      parameters.reasoningEffort === 'low' ||
      parameters.reasoningEffort === 'medium'
        ? parameters.reasoningEffort
        : 'high';
    const current = input.current?.trim() || '';
    const generationPrompt = current
      ? `Rewrite or expand the following copy. Return only the finished copy.\nRequirements: ${prompt}\nOriginal: ${current}`
      : `Write copy for a creative canvas. Return only the finished copy.\nRequirements: ${prompt}`;
    upstreamUsdMicros = estimateStudioLanguageUpstreamUsdMicros({
      modelId: input.modelId,
      inputTokens: Math.max(
        1_024,
        new TextEncoder().encode(generationPrompt).length + 512,
      ),
      outputTokens:
        effort === 'low' ? 1_024 : effort === 'medium' ? 2_048 : 4_096,
    });
  }

  return priceStudioUsage({
    modelId: input.modelId,
    upstreamUsdMicros,
    runtime,
  });
}
