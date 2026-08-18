import {
  STUDIO_CHAT_MODEL,
  STUDIO_FREE_CREDIT_AGENT_MODEL,
  STUDIO_IMAGE_MODEL,
  STUDIO_TEXT_MODEL,
  STUDIO_VIDEO_MODEL,
} from './models';
import type { StudioGenerativeKind, StudioNodeKind } from './types';

export type StudioImageAspect =
  | '1:1'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '3:2'
  | '2:3'
  | '2:1'
  | '1:2'
  | '19.5:9'
  | '9:19.5'
  | '20:9'
  | '9:20'
  | 'auto';

export type StudioVideoAspect = '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9' | 'adaptive';

export type CatalogField =
  | { type: 'aspect'; key: 'aspect'; label: string; options: string[] }
  | { type: 'enum'; key: string; label: string; options: { id: string; label: string }[] }
  | { type: 'range'; key: string; label: string; min: number; max: number; step: number; unit: string }
  | { type: 'stepper'; key: string; label: string; min: number; max: number }
  | { type: 'toggle'; key: string; label: string };

export interface StudioModelSpec {
  id: string;
  label: string;
  kind: StudioGenerativeKind;
  fields: CatalogField[];
  maxRefs: number;
  defaults: Record<string, string | number | boolean>;
}

export interface StudioModelOption {
  id: string;
  label: string;
  provider: string;
  description: string;
  tag: string;
  freeCredit: boolean;
}

export const STUDIO_MODEL_OPTIONS: Record<
  StudioGenerativeKind,
  readonly StudioModelOption[]
> = {
  image: [
    {
      id: STUDIO_IMAGE_MODEL,
      label: 'Grok Imagine 2.0',
      provider: 'xAI',
      description: 'Photoreal detail and cinematic imagery',
      tag: 'Recommended',
      freeCredit: false,
    },
    {
      id: 'bytedance/seedream-5.0-pro',
      label: 'Seedream 5.0 Pro',
      provider: 'ByteDance',
      description: 'Design-led output and complex prompts',
      tag: 'Free credit',
      freeCredit: true,
    },
    {
      id: 'openai/gpt-image-2',
      label: 'GPT Image 2',
      provider: 'OpenAI',
      description: 'Reliable composition for general use',
      tag: 'General',
      freeCredit: false,
    },
    {
      id: 'recraft/recraft-v4.1-pro',
      label: 'Recraft V4.1 Pro',
      provider: 'Recraft',
      description: 'Brand graphics and commercial visuals',
      tag: 'Brand',
      freeCredit: false,
    },
  ],
  video: [
    {
      id: STUDIO_VIDEO_MODEL,
      label: 'Seedance 2.5',
      provider: 'ByteDance',
      description: 'High-quality shots and motion',
      tag: 'Recommended',
      freeCredit: false,
    },
    {
      id: 'bytedance/seedance-2.0-fast',
      label: 'Seedance 2.0 Fast',
      provider: 'ByteDance',
      description: 'Fast previews and iteration',
      tag: 'Fast',
      freeCredit: false,
    },
    {
      id: 'bytedance/seedance-2.0',
      label: 'Seedance 2.0',
      provider: 'ByteDance',
      description: 'Stable quality with image references',
      tag: 'Balanced',
      freeCredit: false,
    },
  ],
  text: [
    {
      id: STUDIO_FREE_CREDIT_AGENT_MODEL,
      label: 'Laguna S 2.1 Free',
      provider: 'Poolside',
      description: 'Zero-cost drafts with reasoning and tool use',
      tag: 'Free credit',
      freeCredit: true,
    },
    {
      id: STUDIO_TEXT_MODEL,
      label: 'GPT 5.6 Terra',
      provider: 'OpenAI',
      description: 'Balanced creativity and speed',
      tag: 'Recommended',
      freeCredit: false,
    },
    {
      id: 'openai/gpt-5.6-luna',
      label: 'GPT 5.6 Luna',
      provider: 'OpenAI',
      description: 'Fast drafts and batch rewrites',
      tag: 'Fast',
      freeCredit: false,
    },
    {
      id: 'openai/gpt-5.6-sol',
      label: 'GPT 5.6 Sol',
      provider: 'OpenAI',
      description: 'Complex creation and deeper reasoning',
      tag: 'Quality',
      freeCredit: false,
    },
  ],
};

/**
 * Capabilities are taken from Vercel AI SDK provider docs:
 * Current capabilities are sourced from the Vercel AI Gateway catalog.
 * Model ids were refreshed against the Gateway catalog on 2026-08-18.
 * All ids are routed through the AI SDK's global Gateway provider.
 */
export const STUDIO_MODELS: Record<StudioGenerativeKind, StudioModelSpec> = {
  image: {
    id: STUDIO_IMAGE_MODEL,
    label: 'Grok Imagine 2.0',
    kind: 'image',
    maxRefs: 3,
    defaults: { aspect: '1:1', n: 1 },
    fields: [
      {
        type: 'aspect',
        key: 'aspect',
        label: 'Aspect ratio',
        options: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
      { type: 'stepper', key: 'n', label: 'Outputs', min: 1, max: 4 },
    ],
  },
  video: {
    id: STUDIO_VIDEO_MODEL,
    label: 'Seedance 2.5',
    kind: 'video',
    maxRefs: 1,
    defaults: { aspect: '16:9', duration: 5, videoResolution: '720p', generateAudio: false },
    fields: [
      {
        type: 'aspect',
        key: 'aspect',
        label: 'Aspect ratio',
        options: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
      },
      {
        type: 'enum',
        key: 'videoResolution',
        label: 'Resolution',
        options: [
          { id: '480p', label: '480p' },
          { id: '720p', label: '720p' },
        ],
      },
      { type: 'range', key: 'duration', label: 'Duration', min: 4, max: 30, step: 1, unit: 'sec' },
      { type: 'toggle', key: 'generateAudio', label: 'Generate audio' },
    ],
  },
  text: {
    id: STUDIO_TEXT_MODEL,
    label: 'GPT 5.6 Terra',
    kind: 'text',
    maxRefs: 0,
    defaults: { reasoningEffort: 'high' },
    fields: [
      {
        type: 'enum',
        key: 'reasoningEffort',
        label: 'Reasoning effort',
        options: [
          { id: 'low', label: 'Low' },
          { id: 'medium', label: 'Medium' },
          { id: 'high', label: 'High' },
        ],
      },
    ],
  },
};

export function modelForKind(kind: StudioNodeKind) {
  if (kind === 'section') {
    throw new Error('Section nodes do not have a generation model.');
  }
  return STUDIO_MODELS[kind];
}

export function modelOptionsForKind(kind: StudioGenerativeKind) {
  return STUDIO_MODEL_OPTIONS[kind];
}

export function isStudioModelAvailable(
  model: StudioModelOption,
  freeCreditModelsOnly = false,
) {
  return !freeCreditModelsOnly || model.freeCredit;
}

export function hasAvailableStudioModel(
  kind: StudioGenerativeKind,
  freeCreditModelsOnly = false,
) {
  return modelOptionsForKind(kind).some((model) =>
    isStudioModelAvailable(model, freeCreditModelsOnly),
  );
}

export function resolveStudioModel(
  kind: StudioGenerativeKind,
  modelId?: unknown,
  freeCreditModelsOnly = false,
) {
  const options = modelOptionsForKind(kind);
  const available = options.filter((model) =>
    isStudioModelAvailable(model, freeCreditModelsOnly),
  );
  const candidates = available.length ? available : options;
  return (
    candidates.find((option) => option.id === modelId) ??
    candidates.find((option) => option.id === modelForKind(kind).id) ??
    candidates[0]
  );
}

export function chatModelId(freeCreditModelsOnly = false) {
  return freeCreditModelsOnly
    ? STUDIO_FREE_CREDIT_AGENT_MODEL
    : STUDIO_CHAT_MODEL;
}

export function fieldSummary(kind: StudioNodeKind, values: Record<string, unknown>) {
  const spec = modelForKind(kind);
  return spec.fields
    .map((field) => {
      const raw = values[field.key] ?? spec.defaults[field.key];
      if (field.type === 'toggle') return raw ? field.label : null;
      if (field.type === 'range') return `${raw}${field.unit}`;
      if (field.type === 'stepper') return `${raw} outputs`;
      if (field.type === 'enum') return field.options.find((item) => item.id === raw)?.label || String(raw);
      return String(raw);
    })
    .filter(Boolean)
    .join(' · ');
}

export function videoPixelSize(aspect: string, resolution: '480p' | '720p') {
  const short = resolution === '720p' ? 720 : 480;
  const parts = aspect.split(':').map(Number);
  const rw = parts[0] || 16;
  const rh = parts[1] || 9;
  if (rw >= rh) {
    const width = Math.round((short * rw) / rh);
    return `${width}x${short}` as `${number}x${number}`;
  }
  const height = Math.round((short * rh) / rw);
  return `${short}x${height}` as `${number}x${number}`;
}
