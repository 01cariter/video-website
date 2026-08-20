import type { JSONValue } from 'ai';

export const STUDIO_IMAGE_MODEL_IDS = [
  'xai/grok-imagine-image-2.0',
  'bytedance/seedream-5.0-pro',
  'openai/gpt-image-2',
  'recraft/recraft-v4.1',
  'google/gemini-3.1-flash-image',
] as const;

export type StudioImageModelId = (typeof STUDIO_IMAGE_MODEL_IDS)[number];

export type StudioImageParameters = Record<string, unknown>;

export interface PrepareStudioImageRequestInput {
  modelId: unknown;
  prompt: unknown;
  parameters?: StudioImageParameters;
  referenceImages?: unknown;
}

export interface StudioImageRequestBodyLike {
  aspect?: unknown;
  n?: unknown;
  quality?: unknown;
  resolution?: unknown;
  size?: unknown;
  style?: unknown;
  imageSize?: unknown;
  thinkingLevel?: unknown;
  parameters?: unknown;
}

export interface PreparedImageModelCall {
  mode: 'image-model';
  model: Exclude<StudioImageModelId, 'google/gemini-3.1-flash-image'>;
  prompt: string | { text: string; images: string[] };
  n: number;
  size?: `${number}x${number}`;
  aspectRatio?: `${number}:${number}`;
  maxImagesPerCall?: number;
  providerOptions?: Record<
    string,
    Record<string, JSONValue | undefined>
  >;
}

export interface PreparedLanguageImageCall {
  mode: 'language-model';
  model: 'google/gemini-3.1-flash-image';
  prompt: string;
  referenceImages: string[];
  count: number;
  providerOptions: {
    google: {
      responseModalities: ['TEXT', 'IMAGE'];
      imageConfig: {
        aspectRatio: GeminiAspect;
        imageSize: GeminiImageSize;
      };
      thinkingConfig: { thinkingLevel: GeminiThinkingLevel };
    };
  };
}

export type PreparedImageProviderCall =
  | PreparedImageModelCall
  | PreparedLanguageImageCall;

export interface PreparedStudioImageRequest {
  modelId: StudioImageModelId;
  prompt: string;
  count: number;
  parameters: Record<string, string | number>;
  referenceImages: string[];
  upstreamUsdMicros: number;
  providerCall: PreparedImageProviderCall;
}

export class StudioImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudioImageValidationError';
  }
}

const MAX_PROMPT_LENGTH = 20_000;
const MAX_OUTPUTS = 4;
const MAX_REFERENCES = 3;

const XAI_ASPECTS = new Set([
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
]);

const SEEDREAM_SIZES = new Set([
  '1024x1024',
  '1280x720',
  '720x1280',
  '1280x960',
  '960x1280',
  '1536x1024',
  '1024x1536',
  '1920x1080',
  '1080x1920',
  '2048x2048',
]);

const SEEDREAM_SIZE_BY_ASPECT: Record<string, `${number}x${number}`> = {
  '1:1': '1024x1024',
  '16:9': '1280x720',
  '9:16': '720x1280',
  '4:3': '1280x960',
  '3:4': '960x1280',
  '3:2': '1536x1024',
  '2:3': '1024x1536',
};

const GPT_IMAGE_SIZES = new Set([
  '1024x1024',
  '1536x1024',
  '1024x1536',
]);
const GPT_IMAGE_QUALITIES = new Set(['low', 'medium', 'high']);

// Published GPT Image 2 output-only estimates. They are deliberately a
// parameter table rather than a flat per-image price because output token use
// changes with both quality and dimensions.
const GPT_IMAGE_OUTPUT_MICROS: Record<string, Record<string, number>> = {
  low: {
    '1024x1024': 6_000,
    '1536x1024': 5_000,
    '1024x1536': 5_000,
  },
  medium: {
    '1024x1024': 53_000,
    '1536x1024': 41_000,
    '1024x1536': 41_000,
  },
  high: {
    '1024x1024': 211_000,
    '1536x1024': 165_000,
    '1024x1536': 165_000,
  },
};

const GPT_IMAGE_SIZE_BY_ASPECT: Record<string, string> = {
  '1:1': '1024x1024',
  '3:2': '1536x1024',
  '2:3': '1024x1536',
};
// GPT Image 2 always processes edit inputs at high fidelity, but the provider
// cannot preflight URL dimensions. Use the larger published high-fidelity
// portrait/landscape allowance so credit authorization remains conservative.
const GPT_REFERENCE_INPUT_TOKEN_RESERVE = 6_240;

const RECRAFT_SIZES = new Set([
  '1024x1024',
  '1365x1024',
  '1024x1365',
  '1536x1024',
  '1024x1536',
  '1820x1024',
  '1024x1820',
  '1024x2048',
  '2048x1024',
  '1434x1024',
  '1024x1434',
  '1024x1280',
  '1280x1024',
  '1024x1707',
  '1707x1024',
]);
const RECRAFT_STYLES = new Set(['raster', 'vector_illustration']);

const GEMINI_ASPECTS = new Set([
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
]);
type GeminiAspect =
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '21:9';
const GEMINI_IMAGE_SIZES = new Set(['512', '1K', '2K', '4K']);
type GeminiImageSize = '512' | '1K' | '2K' | '4K';
const GEMINI_THINKING_LEVELS = new Set(['minimal', 'high']);
type GeminiThinkingLevel = 'minimal' | 'high';
const GEMINI_IMAGE_MICROS: Record<GeminiImageSize, number> = {
  '512': 45_000,
  '1K': 67_000,
  '2K': 101_000,
  '4K': 151_000,
};
const GEMINI_TEXT_OUTPUT_TOKEN_RESERVE: Record<GeminiThinkingLevel, number> = {
  minimal: 512,
  high: 4_096,
};

export function isStudioImageModelId(value: unknown): value is StudioImageModelId {
  return (
    typeof value === 'string' &&
    (STUDIO_IMAGE_MODEL_IDS as readonly string[]).includes(value)
  );
}

export function imageParametersFromBody(
  body: StudioImageRequestBodyLike,
): StudioImageParameters {
  if (
    body.parameters != null &&
    (typeof body.parameters !== 'object' ||
      Array.isArray(body.parameters))
  ) {
    throw new StudioImageValidationError(
      'Image parameters must be an object.',
    );
  }
  const legacy: StudioImageParameters = {};
  for (const key of [
    'aspect',
    'n',
    'quality',
    'resolution',
    'size',
    'style',
    'imageSize',
    'thinkingLevel',
  ] as const) {
    if (body[key] !== undefined) legacy[key] = body[key];
  }
  return {
    ...legacy,
    ...((body.parameters as StudioImageParameters | undefined) ?? {}),
  };
}

export function prepareStudioImageRequest(
  input: PrepareStudioImageRequestInput,
): PreparedStudioImageRequest {
  if (!isStudioImageModelId(input.modelId)) {
    throw new StudioImageValidationError('Unsupported image model.');
  }
  if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
    throw new StudioImageValidationError('Add a prompt first.');
  }
  const prompt = input.prompt.trim();
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new StudioImageValidationError('The image prompt is too long.');
  }

  const parameters = input.parameters ?? {};
  const count = integerParameter(parameters.n, 'n', 1, MAX_OUTPUTS, 1);
  const referenceImages = normalizeReferenceImages(input.referenceImages);

  switch (input.modelId) {
    case 'xai/grok-imagine-image-2.0':
      return prepareXai(prompt, count, parameters, referenceImages);
    case 'bytedance/seedream-5.0-pro':
      return prepareSeedream(prompt, count, parameters, referenceImages);
    case 'openai/gpt-image-2':
      return prepareGptImage(prompt, count, parameters, referenceImages);
    case 'recraft/recraft-v4.1':
      return prepareRecraft(prompt, count, parameters, referenceImages);
    case 'google/gemini-3.1-flash-image':
      return prepareGemini(prompt, count, parameters, referenceImages);
  }
}

function prepareXai(
  prompt: string,
  count: number,
  parameters: StudioImageParameters,
  referenceImages: string[],
): PreparedStudioImageRequest {
  validateParameterKeys(parameters, ['aspect', 'n', 'quality', 'resolution']);
  // The current Gateway model advertises text-only input. Do not confuse it
  // with Grok Imagine edit/preview model ids that have separate capabilities.
  rejectReferences(referenceImages, 'Grok Imagine Image 2.0');
  const aspect = enumParameter(parameters.aspect, 'aspect', XAI_ASPECTS, '1:1');
  const quality = enumParameter(
    parameters.quality,
    'quality',
    new Set(['low', 'medium']),
    'medium',
  );
  const resolution = enumParameter(
    parameters.resolution,
    'resolution',
    new Set(['1k', '2k']),
    '1k',
  );
  const perImageMicros =
    resolution === '2k'
      ? quality === 'low'
        ? 60_000
        : 80_000
      : quality === 'low'
        ? 40_000
        : 60_000;
  const xaiOptions: Record<string, JSONValue | undefined> = {};
  if (quality !== 'medium') xaiOptions.quality = quality;
  if (resolution !== '1k') xaiOptions.resolution = resolution;

  return {
    modelId: 'xai/grok-imagine-image-2.0',
    prompt,
    count,
    parameters: { aspect, n: count, quality, resolution },
    referenceImages,
    upstreamUsdMicros: perImageMicros * count,
    providerCall: {
      mode: 'image-model',
      model: 'xai/grok-imagine-image-2.0',
      prompt,
      n: count,
      aspectRatio:
        aspect === 'auto' ? undefined : (aspect as `${number}:${number}`),
      providerOptions: Object.keys(xaiOptions).length
        ? { xai: xaiOptions }
        : undefined,
    },
  };
}

function prepareSeedream(
  prompt: string,
  count: number,
  parameters: StudioImageParameters,
  referenceImages: string[],
): PreparedStudioImageRequest {
  validateParameterKeys(parameters, ['aspect', 'n', 'size']);
  const requestedSize = parameters.size;
  const fallbackSize = SEEDREAM_SIZE_BY_ASPECT[stringParameter(parameters.aspect)] ??
    '1024x1024';
  const size = enumParameter(
    requestedSize,
    'size',
    SEEDREAM_SIZES,
    fallbackSize,
  ) as `${number}x${number}`;
  // ByteDance publishes $0.003/M input tokens. UTF-8 bytes are a safe upper
  // bound for prompt tokens and keep pre-authorization deterministic.
  const inputMicros = utf8Bytes(prompt) * 0.003;

  return {
    modelId: 'bytedance/seedream-5.0-pro',
    prompt,
    count,
    parameters: { size, n: count },
    referenceImages,
    upstreamUsdMicros: Math.ceil((35_000 + inputMicros) * count),
    providerCall: {
      mode: 'image-model',
      model: 'bytedance/seedream-5.0-pro',
      prompt: referenceImages.length
        ? { text: prompt, images: referenceImages }
        : prompt,
      n: count,
      size,
      // Seedream 5.0 Pro produces one image per native generation. Let the AI
      // SDK split a multi-output product request into auditable single calls.
      maxImagesPerCall: 1,
    },
  };
}

function prepareGptImage(
  prompt: string,
  count: number,
  parameters: StudioImageParameters,
  referenceImages: string[],
): PreparedStudioImageRequest {
  validateParameterKeys(parameters, ['aspect', 'n', 'quality', 'size']);
  const fallbackSize = GPT_IMAGE_SIZE_BY_ASPECT[stringParameter(parameters.aspect)] ??
    '1024x1024';
  const size = enumParameter(
    parameters.size,
    'size',
    GPT_IMAGE_SIZES,
    fallbackSize,
  ) as `${number}x${number}`;
  const quality = enumParameter(
    parameters.quality,
    'quality',
    GPT_IMAGE_QUALITIES,
    'low',
  );
  const outputMicros = GPT_IMAGE_OUTPUT_MICROS[quality]?.[size];
  if (!outputMicros) {
    throw new StudioImageValidationError(
      'Unsupported GPT Image 2 size and quality combination.',
    );
  }
  // GPT Image 2 text input is $5/M tokens and image input is $8/M tokens.
  const promptInputMicros = utf8Bytes(prompt) * 5;
  const referenceInputMicros =
    referenceImages.length * GPT_REFERENCE_INPUT_TOKEN_RESERVE * 8;

  return {
    modelId: 'openai/gpt-image-2',
    prompt,
    count,
    parameters: { size, quality, n: count },
    referenceImages,
    upstreamUsdMicros:
      outputMicros * count + promptInputMicros + referenceInputMicros,
    providerCall: {
      mode: 'image-model',
      model: 'openai/gpt-image-2',
      prompt: referenceImages.length
        ? { text: prompt, images: referenceImages }
        : prompt,
      n: count,
      size,
      providerOptions: { openai: { quality } },
    },
  };
}

function prepareRecraft(
  prompt: string,
  count: number,
  parameters: StudioImageParameters,
  referenceImages: string[],
): PreparedStudioImageRequest {
  validateParameterKeys(parameters, ['aspect', 'n', 'size', 'style']);
  rejectReferences(referenceImages, 'Recraft V4.1');
  const fallbackSize = GPT_IMAGE_SIZE_BY_ASPECT[stringParameter(parameters.aspect)] ??
    '1024x1024';
  const size = enumParameter(
    parameters.size,
    'size',
    RECRAFT_SIZES,
    fallbackSize,
  ) as `${number}x${number}`;
  const style = enumParameter(
    parameters.style,
    'style',
    RECRAFT_STYLES,
    'raster',
  );

  return {
    modelId: 'recraft/recraft-v4.1',
    prompt,
    count,
    parameters: { size, style, n: count },
    referenceImages,
    upstreamUsdMicros:
      (style === 'vector_illustration' ? 80_000 : 35_000) * count,
    providerCall: {
      mode: 'image-model',
      model: 'recraft/recraft-v4.1',
      prompt,
      n: count,
      size,
      providerOptions:
        style === 'vector_illustration'
          ? { recraft: { style: 'vector_illustration' } }
          : undefined,
    },
  };
}

function prepareGemini(
  prompt: string,
  count: number,
  parameters: StudioImageParameters,
  referenceImages: string[],
): PreparedStudioImageRequest {
  validateParameterKeys(parameters, [
    'aspect',
    'n',
    'imageSize',
    'size',
    'thinkingLevel',
  ]);
  const aspect = enumParameter(
    parameters.aspect,
    'aspect',
    GEMINI_ASPECTS,
    '1:1',
  ) as GeminiAspect;
  const rawImageSize = parameters.imageSize ?? parameters.size;
  const imageSize = enumParameter(
    rawImageSize,
    'imageSize',
    GEMINI_IMAGE_SIZES,
    '1K',
  ) as GeminiImageSize;
  const thinkingLevel = enumParameter(
    parameters.thinkingLevel,
    'thinkingLevel',
    GEMINI_THINKING_LEVELS,
    'minimal',
  ) as GeminiThinkingLevel;
  // Gemini input is $0.50/M tokens. Reserve 2,048 input tokens per reference
  // and a small TEXT-modality response allowance at $3/M; the image itself is
  // billed by the selected resolution.
  const promptInputMicros = utf8Bytes(prompt) * 0.5;
  const referenceInputMicros = referenceImages.length * 2_048 * 0.5;
  const textOutputReserveMicros =
    GEMINI_TEXT_OUTPUT_TOKEN_RESERVE[thinkingLevel] * 3;

  return {
    modelId: 'google/gemini-3.1-flash-image',
    prompt,
    count,
    parameters: { aspect, imageSize, thinkingLevel, n: count },
    referenceImages,
    upstreamUsdMicros: Math.ceil(
      GEMINI_IMAGE_MICROS[imageSize] * count +
      promptInputMicros * count +
      referenceInputMicros * count +
      textOutputReserveMicros * count,
    ),
    providerCall: {
      mode: 'language-model',
      model: 'google/gemini-3.1-flash-image',
      prompt,
      referenceImages,
      count,
      providerOptions: {
        google: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: aspect, imageSize },
          thinkingConfig: { thinkingLevel },
        },
      },
    },
  };
}

function normalizeReferenceImages(value: unknown) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new StudioImageValidationError('Reference images must be an array.');
  }
  if (value.length > MAX_REFERENCES) {
    throw new StudioImageValidationError(
      `Use at most ${MAX_REFERENCES} reference images.`,
    );
  }
  return value.map((item) => {
    if (typeof item !== 'string' || !isSupportedReferenceSource(item)) {
      throw new StudioImageValidationError('Invalid reference image source.');
    }
    return item;
  });
}

function validateParameterKeys(
  parameters: StudioImageParameters,
  allowedKeys: readonly string[],
) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(parameters)) {
    if (!allowed.has(key)) {
      throw new StudioImageValidationError(
        `Unsupported image parameter for this model: ${key}.`,
      );
    }
  }
}

function isSupportedReferenceSource(value: string) {
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value)) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function rejectReferences(referenceImages: string[], label: string) {
  if (referenceImages.length) {
    throw new StudioImageValidationError(
      `${label} does not support reference images in this product.`,
    );
  }
}

function integerParameter(
  value: unknown,
  label: string,
  min: number,
  max: number,
  fallback: number,
) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new StudioImageValidationError(
      `${label} must be an integer from ${min} to ${max}.`,
    );
  }
  return Number(value);
}

function enumParameter(
  value: unknown,
  label: string,
  allowed: Set<string>,
  fallback: string,
) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new StudioImageValidationError(`Unsupported ${label}.`);
  }
  return value;
}

function stringParameter(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}
