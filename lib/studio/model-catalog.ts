import {
  DEFAULT_STUDIO_RUNTIME_CONFIG,
  type StudioRuntimeConfig,
} from './pricing';
import {
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
  | '4:5'
  | '5:4'
  | '3:2'
  | '2:3'
  | '2:1'
  | '1:2'
  | '19.5:9'
  | '9:19.5'
  | '20:9'
  | '9:20'
  | '21:9'
  | 'auto';

export type StudioVideoAspect =
  | '16:9'
  | '4:3'
  | '1:1'
  | '3:4'
  | '9:16'
  | '21:9'
  | 'adaptive';

export type CatalogField =
  | { type: 'aspect'; key: 'aspect'; label: string; options: string[] }
  | {
      type: 'enum';
      key: string;
      label: string;
      options: { id: string; label: string }[];
    }
  | {
      type: 'range';
      key: string;
      label: string;
      min: number;
      max: number;
      step: number;
      unit: string;
    }
  | {
      type: 'stepper';
      key: string;
      label: string;
      min: number;
      max: number;
    }
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
}

const outputCount: CatalogField = {
  type: 'stepper',
  key: 'n',
  label: 'Outputs',
  min: 1,
  max: 4,
};
const audioToggle: CatalogField = {
  type: 'toggle',
  key: 'generateAudio',
  label: 'Generate audio',
};
const reasoningField: CatalogField = {
  type: 'enum',
  key: 'reasoningEffort',
  label: 'Reasoning effort',
  options: [
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
  ],
};

const aspect = (...options: string[]): CatalogField => ({
  type: 'aspect',
  key: 'aspect',
  label: 'Aspect ratio',
  options,
});
const choice = (
  key: string,
  label: string,
  options: Array<string | readonly [string, string]>,
): CatalogField => ({
  type: 'enum',
  key,
  label,
  options: options.map((option) =>
    typeof option === 'string'
      ? { id: option, label: option }
      : { id: option[0], label: option[1] },
  ),
});
const durationRange = (min: number, max: number): CatalogField => ({
  type: 'range',
  key: 'duration',
  label: 'Duration',
  min,
  max,
  step: 1,
  unit: 'sec',
});
const veoDuration: CatalogField = {
  type: 'range',
  key: 'duration',
  label: 'Duration',
  min: 4,
  max: 8,
  step: 2,
  unit: 'sec',
};

export const STUDIO_MODEL_OPTIONS: Record<
  StudioGenerativeKind,
  readonly StudioModelOption[]
> = {
  image: [
    {
      id: 'spacexai/grok-imagine-image-2.0',
      label: 'Grok Imagine Image 2.0',
      provider: 'xAI',
      description: 'Fast photoreal and cinematic imagery',
      tag: 'Recommended',
    },
    {
      id: 'bytedance/seedream-5.0-pro',
      label: 'Seedream 5.0 Pro',
      provider: 'ByteDance',
      description: 'Design-led output and reference images',
      tag: 'Design',
    },
    {
      id: 'openai/gpt-image-2',
      label: 'GPT Image 2',
      provider: 'OpenAI',
      description: 'Reliable composition and prompt adherence',
      tag: 'Quality',
    },
    {
      id: 'recraft/recraft-v4.1',
      label: 'Recraft V4.1',
      provider: 'Recraft',
      description: 'Raster and vector brand graphics',
      tag: 'Brand',
    },
    {
      id: 'google/gemini-3.1-flash-image',
      label: 'Gemini 3.1 Flash Image',
      provider: 'Google',
      description: 'High-resolution multimodal image creation',
      tag: '4K',
    },
  ],
  video: [
    {
      id: 'bytedance/seedance-2.5',
      label: 'Seedance 2.5',
      provider: 'ByteDance',
      description: 'Flexible duration with optional audio',
      tag: 'Recommended',
    },
    {
      id: 'minimax/minimax-h3',
      label: 'MiniMax Hailuo 3',
      provider: 'MiniMax',
      description: '2K cinematic video generation',
      tag: '2K',
    },
    {
      id: 'spacexai/grok-imagine-video-1.5',
      label: 'Grok Imagine Video 1.5',
      provider: 'xAI',
      description: 'Reference-aware generation with native audio',
      tag: 'Fast',
    },
    {
      id: 'google/veo-3.1-lite-generate-001',
      label: 'Veo 3.1 Lite',
      provider: 'Google',
      description: 'Cost-efficient text-to-video with native audio',
      tag: 'Value',
    },
    {
      id: 'google/veo-3.1-fast-generate-001',
      label: 'Veo 3.1 Fast',
      provider: 'Google',
      description: 'Fast reference-aware generation up to 4K',
      tag: 'Fast 4K',
    },
    {
      id: 'google/veo-3.1-generate-001',
      label: 'Veo 3.1',
      provider: 'Google',
      description: 'Premium video quality up to 4K',
      tag: 'Premium',
    },
  ],
  text: [
    {
      id: 'deepseek/deepseek-v4-flash',
      label: 'DeepSeek V4 Flash',
      provider: 'DeepSeek',
      description: 'Fast, efficient planning and drafting',
      tag: 'Agent default',
    },
    {
      id: 'openai/gpt-5.6-luna',
      label: 'GPT 5.6 Luna',
      provider: 'OpenAI',
      description: 'Fast drafts and batch rewrites',
      tag: 'Fast',
    },
    {
      id: 'openai/gpt-5.6-terra',
      label: 'GPT 5.6 Terra',
      provider: 'OpenAI',
      description: 'Balanced creativity and reasoning',
      tag: 'Recommended',
    },
    {
      id: 'openai/gpt-5.6-sol',
      label: 'GPT 5.6 Sol',
      provider: 'OpenAI',
      description: 'Complex creation and deeper reasoning',
      tag: 'Quality',
    },
    {
      id: 'anthropic/claude-sonnet-5',
      label: 'Claude Sonnet 5',
      provider: 'Anthropic',
      description: 'Long-form creative reasoning',
      tag: 'Writing',
    },
    {
      id: 'google/gemini-3.1-pro-preview',
      label: 'Gemini 3.1 Pro',
      provider: 'Google',
      description: 'Advanced multimodal reasoning',
      tag: 'Multimodal',
    },
  ],
};

const veoFields = (
  resolutions: string[],
  includeAudioToggle = true,
): CatalogField[] => [
  aspect('16:9', '9:16'),
  choice('videoResolution', 'Resolution', resolutions),
  veoDuration,
  ...(includeAudioToggle ? [audioToggle] : []),
];

export const STUDIO_MODEL_SPECS: Record<string, StudioModelSpec> = {
  'spacexai/grok-imagine-image-2.0': {
    id: 'spacexai/grok-imagine-image-2.0',
    label: 'Grok Imagine Image 2.0',
    kind: 'image',
    maxRefs: 5,
    defaults: { aspect: '1:1', n: 1, quality: 'medium', resolution: '1k' },
    fields: [
      aspect(
        '1:1',
        '16:9',
        '9:16',
        '4:3',
        '3:4',
        '3:2',
        '2:3',
        '2:1',
        '1:2',
        '19.5:9',
        '9:19.5',
        '20:9',
        '9:20',
        'auto',
      ),
      choice('quality', 'Quality', [['low', 'Low'], ['medium', 'Standard']]),
      choice('resolution', 'Resolution', [['1k', '1K'], ['2k', '2K']]),
      outputCount,
    ],
  },
  'bytedance/seedream-5.0-pro': {
    id: 'bytedance/seedream-5.0-pro',
    label: 'Seedream 5.0 Pro',
    kind: 'image',
    maxRefs: 10,
    defaults: { size: '1024x1024', n: 1 },
    fields: [
      choice('size', 'Size', [
        ['1024x1024', 'Square'], ['1280x720', 'Landscape'], ['720x1280', 'Portrait'],
        ['1280x960', '4:3'], ['960x1280', '3:4'], ['1536x1024', '3:2'],
        ['1024x1536', '2:3'], ['1920x1080', 'Full HD'], ['1080x1920', 'Full HD portrait'],
        ['2048x2048', '2K square'],
      ]),
      outputCount,
    ],
  },
  'openai/gpt-image-2': {
    id: 'openai/gpt-image-2',
    label: 'GPT Image 2',
    kind: 'image',
    maxRefs: 4,
    defaults: { size: '1024x1024', quality: 'low', n: 1 },
    fields: [
      choice('size', 'Size', [['1024x1024', 'Square'], ['1536x1024', 'Landscape'], ['1024x1536', 'Portrait']]),
      choice('quality', 'Quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]),
      outputCount,
    ],
  },
  'recraft/recraft-v4.1': {
    id: 'recraft/recraft-v4.1',
    label: 'Recraft V4.1',
    kind: 'image',
    maxRefs: 0,
    defaults: { size: '1024x1024', style: 'raster', n: 1 },
    fields: [
      choice('size', 'Size', [
        ['1024x1024', 'Square'], ['1365x1024', '4:3'], ['1024x1365', '3:4'],
        ['1536x1024', '3:2'], ['1024x1536', '2:3'], ['1820x1024', '16:9'],
        ['1024x1820', '9:16'], ['1024x2048', '1:2'], ['2048x1024', '2:1'],
        ['1434x1024', '7:5'], ['1024x1434', '5:7'], ['1024x1280', '4:5'],
        ['1280x1024', '5:4'], ['1024x1707', '3:5'], ['1707x1024', '5:3'],
      ]),
      choice('style', 'Style', [['raster', 'Raster'], ['vector_illustration', 'Vector']]),
      outputCount,
    ],
  },
  'google/gemini-3.1-flash-image': {
    id: 'google/gemini-3.1-flash-image',
    label: 'Gemini 3.1 Flash Image',
    kind: 'image',
    maxRefs: 3,
    defaults: { aspect: '1:1', imageSize: '1K', thinkingLevel: 'minimal', n: 1 },
    fields: [
      aspect('1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'),
      choice('imageSize', 'Resolution', ['512', '1K', '2K', '4K']),
      choice('thinkingLevel', 'Thinking', [['minimal', 'Minimal'], ['high', 'High']]),
      outputCount,
    ],
  },
  'bytedance/seedance-2.5': {
    id: 'bytedance/seedance-2.5',
    label: 'Seedance 2.5',
    kind: 'video',
    maxRefs: 1,
    defaults: { aspect: '16:9', duration: 5, videoResolution: '720p', generateAudio: false },
    fields: [
      aspect('16:9', '4:3', '1:1', '3:4', '9:16', '21:9'),
      choice('videoResolution', 'Resolution', ['480p', '720p', '1080p']),
      durationRange(4, 30),
      audioToggle,
    ],
  },
  'minimax/minimax-h3': {
    id: 'minimax/minimax-h3',
    label: 'MiniMax Hailuo 3',
    kind: 'video',
    maxRefs: 1,
    defaults: { aspect: '16:9', duration: 8, videoResolution: '2k', generateAudio: true },
    fields: [
      aspect('16:9', '4:3', '1:1', '3:4', '9:16', '21:9'),
      choice('videoResolution', 'Resolution', [['2k', '2K']]),
      durationRange(5, 15),
    ],
  },
  'spacexai/grok-imagine-video-1.5': {
    id: 'spacexai/grok-imagine-video-1.5',
    label: 'Grok Imagine Video 1.5',
    kind: 'video',
    maxRefs: 1,
    defaults: { aspect: '16:9', duration: 8, videoResolution: '480p', generateAudio: true },
    fields: [
      aspect('1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'),
      choice('videoResolution', 'Resolution', ['480p', '720p', '1080p']),
      durationRange(1, 15),
    ],
  },
  'google/veo-3.1-lite-generate-001': {
    id: 'google/veo-3.1-lite-generate-001',
    label: 'Veo 3.1 Lite',
    kind: 'video',
    maxRefs: 0,
    defaults: { aspect: '16:9', duration: 8, videoResolution: '720p', generateAudio: true },
    fields: veoFields(['720p', '1080p'], false),
  },
  'google/veo-3.1-fast-generate-001': {
    id: 'google/veo-3.1-fast-generate-001',
    label: 'Veo 3.1 Fast',
    kind: 'video',
    maxRefs: 1,
    defaults: { aspect: '16:9', duration: 8, videoResolution: '720p', generateAudio: false },
    fields: veoFields(['720p', '1080p', '4k']),
  },
  'google/veo-3.1-generate-001': {
    id: 'google/veo-3.1-generate-001',
    label: 'Veo 3.1',
    kind: 'video',
    maxRefs: 1,
    defaults: { aspect: '16:9', duration: 8, videoResolution: '720p', generateAudio: false },
    fields: veoFields(['720p', '1080p', '4k']),
  },
  ...Object.fromEntries(
    STUDIO_MODEL_OPTIONS.text.map((model) => [
      model.id,
      {
        id: model.id,
        label: model.label,
        kind: 'text' as const,
        maxRefs: 0,
        defaults: model.id.startsWith('openai/')
          ? { reasoningEffort: 'high' }
          : {},
        fields: model.id.startsWith('openai/') ? [reasoningField] : [],
      },
    ]),
  ),
};

export const STUDIO_MODELS: Record<StudioGenerativeKind, StudioModelSpec> = {
  image: STUDIO_MODEL_SPECS[STUDIO_IMAGE_MODEL],
  video: STUDIO_MODEL_SPECS[STUDIO_VIDEO_MODEL],
  text: STUDIO_MODEL_SPECS[STUDIO_TEXT_MODEL],
};

type RuntimeInput = StudioRuntimeConfig | boolean | undefined;

function runtimeFrom(input: RuntimeInput) {
  return typeof input === 'object' && input !== null
    ? input
    : DEFAULT_STUDIO_RUNTIME_CONFIG;
}

export function modelForKind(kind: StudioNodeKind) {
  if (kind === 'section') {
    throw new Error('Section nodes do not have a generation model.');
  }
  return STUDIO_MODELS[kind];
}

export function modelSpecFor(
  kind: StudioGenerativeKind,
  modelId?: unknown,
  runtime?: RuntimeInput,
) {
  const model = resolveStudioModel(kind, modelId, runtime);
  return STUDIO_MODEL_SPECS[model.id] ?? STUDIO_MODELS[kind];
}

export function modelOptionsForKind(kind: StudioGenerativeKind) {
  return STUDIO_MODEL_OPTIONS[kind];
}

export function isStudioModelAvailable(
  model: StudioModelOption,
  runtime?: RuntimeInput,
) {
  return (
    runtimeFrom(runtime).modelPolicy[
      model.id as keyof StudioRuntimeConfig['modelPolicy']
    ]?.enabled !== false
  );
}

export function hasAvailableStudioModel(
  kind: StudioGenerativeKind,
  runtime?: RuntimeInput,
) {
  return modelOptionsForKind(kind).some((model) =>
    isStudioModelAvailable(model, runtime),
  );
}

export function resolveStudioModel(
  kind: StudioGenerativeKind,
  modelId?: unknown,
  runtime?: RuntimeInput,
) {
  const options = modelOptionsForKind(kind);
  const available = options.filter((model) =>
    isStudioModelAvailable(model, runtime),
  );
  const candidates = available.length ? available : options;
  const preferred =
    kind === 'text' ? runtimeFrom(runtime).agentModelId : modelForKind(kind).id;
  const normalizedModelId =
    modelId === 'xai/grok-imagine-image-2.0'
      ? 'spacexai/grok-imagine-image-2.0'
      : modelId === 'xai/grok-imagine-video-1.5'
        ? 'spacexai/grok-imagine-video-1.5'
        : modelId;
  return (
    candidates.find((option) => option.id === normalizedModelId) ??
    candidates.find((option) => option.id === preferred) ??
    candidates[0]
  );
}

export function chatModelId(runtime?: RuntimeInput) {
  return resolveStudioModel('text', undefined, runtime).id;
}

export function fieldSummary(
  kind: StudioNodeKind,
  values: Record<string, unknown>,
  modelId?: unknown,
  runtime?: RuntimeInput,
) {
  if (kind === 'section') return '';
  const spec = modelSpecFor(kind, modelId ?? values.modelId, runtime);
  return spec.fields
    .map((field) => {
      const raw = values[field.key] ?? spec.defaults[field.key];
      if (field.type === 'toggle') return raw ? field.label : null;
      if (field.type === 'range') return `${raw}${field.unit}`;
      if (field.type === 'stepper') return `${raw} outputs`;
      if (field.type === 'enum') {
        return (
          field.options.find((item) => item.id === String(raw))?.label ??
          String(raw)
        );
      }
      return String(raw);
    })
    .filter(Boolean)
    .join(' · ');
}

export function videoPixelSize(
  aspectRatio: string,
  resolution: '480p' | '720p' | '1080p' | '2k' | '4k',
) {
  const shortByResolution = {
    '480p': 480,
    '720p': 720,
    '1080p': 1080,
    '2k': 2048,
    '4k': 2160,
  } as const;
  const short = shortByResolution[resolution];
  const [rawWidth, rawHeight] = aspectRatio.split(':').map(Number);
  const ratioWidth = rawWidth || 16;
  const ratioHeight = rawHeight || 9;
  if (ratioWidth >= ratioHeight) {
    const width = Math.round((short * ratioWidth) / ratioHeight / 2) * 2;
    return `${width}x${short}` as `${number}x${number}`;
  }
  const height = Math.round((short * ratioHeight) / ratioWidth / 2) * 2;
  return `${short}x${height}` as `${number}x${number}`;
}
