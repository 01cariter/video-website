import 'server-only';

import { vercelAdapter } from '@flags-sdk/vercel';
import { flag } from 'flags/next';
import {
  DEFAULT_STUDIO_AGENT_MODEL_ID,
  DEFAULT_STUDIO_RUNTIME_CONFIG,
  FAIL_CLOSED_STUDIO_MODEL_POLICY,
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
    'Per-model enabled, upstreamRateBps, markupBps, minimumCredits, creditMode, and fixedCredits. Rate and fixed floors cannot undercut the official sustainable baseline.',
});

async function safeFlagValue<T>(read: () => Promise<T>, fallback: T) {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

export async function getStudioRuntimeConfig(): Promise<StudioRuntimeConfig> {
  const [agentModelId, modelPolicy] = await Promise.all([
    safeFlagValue(() => studioAgentModel(), DEFAULT_STUDIO_AGENT_MODEL_ID),
    safeFlagValue(
      () => studioModelPolicy(),
      FAIL_CLOSED_STUDIO_MODEL_POLICY,
    ),
  ]);

  return normalizeStudioRuntimeConfig({
    agentModelId:
      STUDIO_AGENT_MODEL_IDS.includes(agentModelId)
        ? agentModelId
        : DEFAULT_STUDIO_AGENT_MODEL_ID,
    modelPolicy,
  });
}
