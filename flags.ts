import 'server-only';

import { vercelAdapter } from '@flags-sdk/vercel';
import { flag } from 'flags/next';
import {
  DEFAULT_STUDIO_AGENT_MODEL_ID,
  DEFAULT_STUDIO_RUNTIME_CONFIG,
  STUDIO_AGENT_MODEL_IDS,
  normalizeStudioRuntimeConfig,
  type StudioAgentModelId,
  type StudioModelPolicyOverride,
  type StudioRuntimeConfig,
} from '@/lib/studio/pricing';

export const studioAgentModel = flag<StudioAgentModelId>({
  key: 'studio-agent-model',
  adapter: vercelAdapter,
  defaultValue: DEFAULT_STUDIO_AGENT_MODEL_ID,
  description: 'AI Gateway model used by the Creator Studio Agent.',
  options: [
    { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
    { value: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna' },
    { value: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { value: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { value: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5' },
    {
      value: 'google/gemini-3.1-pro-preview',
      label: 'Gemini 3.1 Pro Preview',
    },
  ],
});

export type StudioModelPolicyFlag = Record<
  string,
  StudioModelPolicyOverride
>;

export const studioModelPolicy = flag<StudioModelPolicyFlag>({
  key: 'studio-model-policy',
  adapter: vercelAdapter,
  defaultValue: DEFAULT_STUDIO_RUNTIME_CONFIG.modelPolicy,
  description:
    'Per-model enabled, markupBps, and minimumCredits overrides. Model contracts and upstream prices remain versioned in code.',
});

/** @deprecated AI Gateway account credits apply to every model. Kept only so
 * older Studio pages can roll forward without a flag-key migration. */
export const freeCreditModelsOnly = flag({
  key: 'free-credit-models-only',
  adapter: vercelAdapter,
  defaultValue: false,
  description:
    'Legacy compatibility flag. AI Gateway free account credits do not restrict the model catalog.',
  options: [
    { value: false, label: 'All Gateway models' },
    { value: true, label: 'Legacy on (no model filtering)' },
  ],
});

async function safeFlagValue<T>(read: () => Promise<T>, fallback: T) {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

export async function getStudioRuntimeConfig(): Promise<StudioRuntimeConfig> {
  const [agentModelId, modelPolicy, legacyFreeCreditModelsOnly] =
    await Promise.all([
      safeFlagValue(() => studioAgentModel(), DEFAULT_STUDIO_AGENT_MODEL_ID),
      safeFlagValue(() => studioModelPolicy(), {}),
      safeFlagValue(() => freeCreditModelsOnly(), false),
    ]);

  return normalizeStudioRuntimeConfig({
    agentModelId:
      STUDIO_AGENT_MODEL_IDS.includes(agentModelId)
        ? agentModelId
        : DEFAULT_STUDIO_AGENT_MODEL_ID,
    modelPolicy,
    legacyFreeCreditModelsOnly,
  });
}
