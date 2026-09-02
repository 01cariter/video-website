export const STUDIO_VIDEO_MODEL_IDS = [
  'bytedance/seedance-2.5',
  'minimax/minimax-h3',
  'spacexai/grok-imagine-video-1.5',
  'google/veo-3.1-lite-generate-001',
  'google/veo-3.1-fast-generate-001',
  'google/veo-3.1-generate-001',
] as const;

export type StudioVideoModelId = (typeof STUDIO_VIDEO_MODEL_IDS)[number];

export const DEFAULT_STUDIO_VIDEO_MODEL_ID: StudioVideoModelId =
  'bytedance/seedance-2.5';

export type StudioVideoResolution =
  | '480p'
  | '720p'
  | '1080p'
  | '2k'
  | '4k';

type StudioVideoAspect = `${number}:${number}` | 'adaptive';

interface StudioVideoContract {
  aspects: readonly StudioVideoAspect[];
  durations: readonly number[] | { min: number; max: number };
  resolutions: Readonly<
    Partial<Record<StudioVideoResolution, `${number}x${number}`>>
  >;
  defaults: {
    aspect: Exclude<StudioVideoAspect, 'adaptive'>;
    duration: number;
    videoResolution: StudioVideoResolution;
    generateAudio: boolean;
  };
  referenceSources: 'url' | 'url-or-data';
  supportsReferenceImage: boolean;
  audioMode: 'optional' | 'always';
}

const STANDARD_VIDEO_ASPECTS = [
  '16:9',
  '4:3',
  '1:1',
  '3:4',
  '9:16',
  '21:9',
] as const;
const SEEDANCE_ASPECTS = [
  ...STANDARD_VIDEO_ASPECTS,
  'adaptive',
] as const;
const GROK_ASPECTS = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
] as const;
const VEO_ASPECTS = ['16:9', '9:16'] as const;

const STUDIO_VIDEO_CONTRACTS: Record<
  StudioVideoModelId,
  StudioVideoContract
> = {
  'bytedance/seedance-2.5': {
    aspects: SEEDANCE_ASPECTS,
    durations: { min: 4, max: 30 },
    resolutions: {
      '480p': '854x480',
      '720p': '1280x720',
      '1080p': '1920x1080',
    },
    defaults: {
      aspect: '16:9',
      duration: 5,
      videoResolution: '720p',
      generateAudio: false,
    },
    referenceSources: 'url',
    supportsReferenceImage: true,
    audioMode: 'optional',
  },
  'minimax/minimax-h3': {
    aspects: STANDARD_VIDEO_ASPECTS,
    durations: { min: 5, max: 15 },
    resolutions: { '2k': '2048x2048' },
    defaults: {
      aspect: '16:9',
      duration: 8,
      videoResolution: '2k',
      generateAudio: true,
    },
    referenceSources: 'url',
    supportsReferenceImage: true,
    audioMode: 'always',
  },
  'spacexai/grok-imagine-video-1.5': {
    aspects: GROK_ASPECTS,
    durations: { min: 1, max: 15 },
    resolutions: {
      '480p': '854x480',
      '720p': '1280x720',
      '1080p': '1920x1080',
    },
    defaults: {
      aspect: '16:9',
      duration: 8,
      videoResolution: '480p',
      generateAudio: true,
    },
    referenceSources: 'url-or-data',
    supportsReferenceImage: true,
    audioMode: 'always',
  },
  'google/veo-3.1-lite-generate-001': {
    aspects: VEO_ASPECTS,
    durations: [4, 6, 8],
    resolutions: {
      '720p': '1280x720',
      '1080p': '1920x1080',
    },
    defaults: {
      aspect: '16:9',
      duration: 8,
      videoResolution: '720p',
      generateAudio: true,
    },
    referenceSources: 'url-or-data',
    supportsReferenceImage: false,
    audioMode: 'always',
  },
  'google/veo-3.1-fast-generate-001': {
    aspects: VEO_ASPECTS,
    durations: [4, 6, 8],
    resolutions: {
      '720p': '1280x720',
      '1080p': '1920x1080',
      '4k': '3840x2160',
    },
    defaults: {
      aspect: '16:9',
      duration: 8,
      videoResolution: '720p',
      generateAudio: false,
    },
    referenceSources: 'url-or-data',
    supportsReferenceImage: true,
    audioMode: 'optional',
  },
  'google/veo-3.1-generate-001': {
    aspects: VEO_ASPECTS,
    durations: [4, 6, 8],
    resolutions: {
      '720p': '1280x720',
      '1080p': '1920x1080',
      '4k': '3840x2160',
    },
    defaults: {
      aspect: '16:9',
      duration: 8,
      videoResolution: '720p',
      generateAudio: false,
    },
    referenceSources: 'url-or-data',
    supportsReferenceImage: true,
    audioMode: 'optional',
  },
};

const VIDEO_PARAMETER_KEYS = new Set([
  'aspect',
  'duration',
  'videoResolution',
  'generateAudio',
]);

export class VideoGenerationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoGenerationValidationError';
  }
}

export function normalizeStudioVideoPrompt(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new VideoGenerationValidationError('Add a prompt first.');
  }
  const prompt = value.trim();
  if (prompt.length > 20_000) {
    throw new VideoGenerationValidationError(
      'The video prompt is too long. Use 20,000 characters or fewer.',
    );
  }
  return prompt;
}

export interface NormalizedStudioVideoRequest {
  modelId: StudioVideoModelId;
  aspect: StudioVideoAspect;
  duration: number;
  videoResolution: StudioVideoResolution;
  resolution: `${number}x${number}`;
  generateAudio: boolean;
  hasReferenceImage: boolean;
  referenceImage?: string;
}

export interface StudioVideoGeneratePayload {
  model: StudioVideoModelId;
  prompt: string | { image: string; text: string };
  aspectRatio: StudioVideoAspect;
  duration: number;
  resolution: `${number}x${number}`;
  generateAudio?: boolean;
  maxRetries: 0;
}

const VIDEO_USD_MICROS_PER_SECOND: Partial<
  Record<
    StudioVideoModelId,
    Partial<
      Record<
        StudioVideoResolution,
        number | { silent: number; audio: number }
      >
    >
  >
> = {
  'minimax/minimax-h3': { '2k': 130_000 },
  'spacexai/grok-imagine-video-1.5': {
    '480p': 80_000,
    '720p': 140_000,
    '1080p': 250_000,
  },
  'google/veo-3.1-lite-generate-001': {
    '720p': { silent: 30_000, audio: 50_000 },
    '1080p': { silent: 50_000, audio: 80_000 },
  },
  'google/veo-3.1-fast-generate-001': {
    '720p': { silent: 100_000, audio: 150_000 },
    '1080p': { silent: 100_000, audio: 150_000 },
    '4k': { silent: 300_000, audio: 350_000 },
  },
  'google/veo-3.1-generate-001': {
    '720p': { silent: 200_000, audio: 400_000 },
    '1080p': { silent: 200_000, audio: 400_000 },
    '4k': { silent: 400_000, audio: 600_000 },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Models that take their output ratio from the first frame and reject an
 * explicit numeric ratio for that operation. Attaching a reference therefore
 * switches them to `adaptive`, which is billed at the widest ratio the model
 * accepts — nothing can measure a remote image before credits are authorised,
 * and undercharging a video is expensive. That costs about 40% more than the
 * numeric ratio, so the interface has to say so where the ratio is chosen.
 */
export function derivesAspectFromReference(modelId: unknown) {
  return modelId === 'bytedance/seedance-2.5';
}

export function isStudioVideoModelId(
  value: unknown,
): value is StudioVideoModelId {
  return (
    typeof value === 'string' &&
    STUDIO_VIDEO_MODEL_IDS.some((modelId) => modelId === value)
  );
}

export function studioVideoContractFor(modelId: StudioVideoModelId) {
  return STUDIO_VIDEO_CONTRACTS[modelId];
}

export function videoParametersFromBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const nested = body.parameters;
  if (nested !== undefined && !isRecord(nested)) {
    throw new VideoGenerationValidationError(
      'Video parameters must be a JSON object.',
    );
  }

  const parameters = nested ?? {};
  const unknownKey = Object.keys(parameters).find(
    (key) => !VIDEO_PARAMETER_KEYS.has(key),
  );
  if (unknownKey) {
    throw new VideoGenerationValidationError(
      `Unsupported video parameter: ${unknownKey}.`,
    );
  }

  const valueFor = (key: string) =>
    Object.prototype.hasOwnProperty.call(parameters, key)
      ? parameters[key]
      : body[key];

  return {
    aspect: valueFor('aspect'),
    duration: valueFor('duration'),
    videoResolution: valueFor('videoResolution'),
    generateAudio: valueFor('generateAudio'),
  };
}

export function videoReferenceFromBody(body: Record<string, unknown>) {
  const multiple = body.refSrcs;
  if (multiple !== undefined && !Array.isArray(multiple)) {
    throw new VideoGenerationValidationError(
      'Video reference images must be an array.',
    );
  }
  if (Array.isArray(multiple) && multiple.length > 1) {
    throw new VideoGenerationValidationError(
      'This generator accepts one reference image at a time.',
    );
  }
  if (
    Array.isArray(multiple) &&
    multiple.length === 1 &&
    typeof multiple[0] !== 'string'
  ) {
    throw new VideoGenerationValidationError(
      'The video reference image must be a URL string.',
    );
  }

  const arrayReference = Array.isArray(multiple) ? multiple[0] : undefined;
  if (
    arrayReference !== undefined &&
    body.refSrc !== undefined &&
    arrayReference !== body.refSrc
  ) {
    throw new VideoGenerationValidationError(
      'Send the reference image once, not in both refSrc and refSrcs.',
    );
  }
  return arrayReference ?? body.refSrc;
}

function normalizeReferenceImage(
  value: unknown,
  contract: StudioVideoContract,
) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!contract.supportsReferenceImage) {
    throw new VideoGenerationValidationError(
      'This video model does not support reference-image generation.',
    );
  }
  if (typeof value !== 'string') {
    throw new VideoGenerationValidationError(
      'The video reference image must be a URL or image data URL.',
    );
  }

  const referenceImage = value.trim();
  let isUrl = false;
  try {
    const parsed = new URL(referenceImage);
    isUrl =
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      Boolean(parsed.hostname);
  } catch {
    isUrl = false;
  }
  const isImageDataUrl = /^data:image\/[a-z0-9.+-]+;base64,/i.test(
    referenceImage,
  );
  if (
    !isUrl &&
    !(contract.referenceSources === 'url-or-data' && isImageDataUrl)
  ) {
    throw new VideoGenerationValidationError(
      contract.referenceSources === 'url'
        ? 'This video model requires a URL reference image.'
        : 'The video reference image must be an HTTP URL or image data URL.',
    );
  }
  return referenceImage;
}

function normalizeDuration(
  value: unknown,
  allowed: StudioVideoContract['durations'],
  fallback: number,
) {
  const duration = value === undefined ? fallback : value;
  if (typeof duration !== 'number' || !Number.isInteger(duration)) {
    throw new VideoGenerationValidationError(
      'Video duration must be a whole number of seconds.',
    );
  }

  if (!('min' in allowed)) {
    if (!allowed.includes(duration)) {
      throw new VideoGenerationValidationError(
        `Video duration must be one of: ${allowed.join(', ')} seconds.`,
      );
    }
  } else if (duration < allowed.min || duration > allowed.max) {
    throw new VideoGenerationValidationError(
      `Video duration must be between ${allowed.min} and ${allowed.max} seconds.`,
    );
  }
  return duration;
}

export function normalizeStudioVideoRequest(input: {
  modelId: unknown;
  parameters: Record<string, unknown>;
  referenceImage?: unknown;
  hasReferenceImage?: boolean;
}): NormalizedStudioVideoRequest {
  const modelId = normalizeStudioVideoModelId(input.modelId);
  if (!modelId) {
    throw new VideoGenerationValidationError(
      'This video model is not supported.',
    );
  }

  const contract = STUDIO_VIDEO_CONTRACTS[modelId];
  const referenceImage = normalizeReferenceImage(
    input.referenceImage,
    contract,
  );
  const hasReferenceImage = Boolean(referenceImage) || input.hasReferenceImage;
  if (hasReferenceImage && !contract.supportsReferenceImage) {
    throw new VideoGenerationValidationError(
      'This video model does not support reference-image generation.',
    );
  }
  const aspect =
    input.parameters.aspect === undefined
      ? contract.defaults.aspect
      : input.parameters.aspect;
  if (
    typeof aspect !== 'string' ||
    !contract.aspects.some((candidate) => candidate === aspect)
  ) {
    throw new VideoGenerationValidationError(
      `${modelId} supports these aspect ratios: ${contract.aspects.join(', ')}.`,
    );
  }
  if (aspect === 'adaptive' && !hasReferenceImage) {
    throw new VideoGenerationValidationError(
      'Adaptive aspect ratio requires a reference image.',
    );
  }
  const normalizedAspect: StudioVideoAspect =
    derivesAspectFromReference(modelId) && hasReferenceImage
      ? 'adaptive'
      : (aspect as StudioVideoAspect);

  const duration = normalizeDuration(
    input.parameters.duration,
    contract.durations,
    contract.defaults.duration,
  );
  const videoResolution =
    input.parameters.videoResolution === undefined
      ? contract.defaults.videoResolution
      : input.parameters.videoResolution;
  if (typeof videoResolution !== 'string') {
    throw new VideoGenerationValidationError(
      'Video resolution must be a supported resolution label.',
    );
  }
  const resolutionTier =
    contract.resolutions[videoResolution as StudioVideoResolution];
  if (!resolutionTier) {
    throw new VideoGenerationValidationError(
      `${modelId} supports these resolutions: ${Object.keys(
        contract.resolutions,
      ).join(', ')}.`,
    );
  }

  if (
    (modelId === 'google/veo-3.1-fast-generate-001' ||
      modelId === 'google/veo-3.1-generate-001') &&
    videoResolution !== '720p' &&
    duration !== 8
  ) {
    throw new VideoGenerationValidationError(
      'Veo 3.1 requires an 8-second duration at 1080p and 4K.',
    );
  }

  const requestedAudio = input.parameters.generateAudio;
  if (requestedAudio !== undefined && typeof requestedAudio !== 'boolean') {
    throw new VideoGenerationValidationError(
      'Generate audio must be true or false.',
    );
  }
  const generateAudio =
    contract.audioMode === 'always'
      ? true
      : requestedAudio ?? contract.defaults.generateAudio;

  return {
    modelId,
    aspect: normalizedAspect,
    duration,
    videoResolution: videoResolution as StudioVideoResolution,
    resolution: gatewayPixelResolution({
      modelId,
      aspect: normalizedAspect,
      videoResolution: videoResolution as StudioVideoResolution,
      resolutionTier,
    }),
    generateAudio,
    hasReferenceImage: Boolean(hasReferenceImage),
    referenceImage,
  };
}

function normalizeStudioVideoModelId(
  value: unknown,
): StudioVideoModelId | undefined {
  if (value === 'xai/grok-imagine-video-1.5') {
    return 'spacexai/grok-imagine-video-1.5';
  }
  return isStudioVideoModelId(value) ? value : undefined;
}

function evenPixel(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

function gatewayPixelResolution(input: {
  modelId: StudioVideoModelId;
  aspect: StudioVideoAspect;
  videoResolution: StudioVideoResolution;
  resolutionTier: `${number}x${number}`;
}): `${number}x${number}` {
  // MiniMax documents 2048x2048 as the sole top-level resolution value even
  // for non-square aspect ratios. For the other providers, the resolution
  // label is a short-edge tier and the Gateway expects dimensions matching
  // the requested orientation.
  if (input.modelId === 'minimax/minimax-h3') {
    return input.resolutionTier;
  }
  if (input.aspect === 'adaptive') {
    return input.resolutionTier;
  }

  const shortEdge =
    input.videoResolution === '480p'
      ? 480
      : input.videoResolution === '720p'
        ? 720
        : input.videoResolution === '1080p'
          ? 1080
          : 2160;
  const [aspectWidth, aspectHeight] = input.aspect.split(':').map(Number);
  if (aspectWidth >= aspectHeight) {
    return `${evenPixel((shortEdge * aspectWidth) / aspectHeight)}x${shortEdge}`;
  }
  return `${shortEdge}x${evenPixel((shortEdge * aspectHeight) / aspectWidth)}`;
}

export function estimateStudioVideoUpstreamUsdMicros(
  request: NormalizedStudioVideoRequest,
) {
  if (request.modelId === 'bytedance/seedance-2.5') {
    let pixels: number;
    if (request.aspect === 'adaptive') {
      const shortEdge =
        request.videoResolution === '480p'
          ? 480
          : request.videoResolution === '720p'
            ? 720
            : 1080;
      // Seedance accepts input-image ratios from 2:5 through 5:2. The route
      // cannot inspect a remote reference before authorizing credits, so use
      // the largest possible pixel area to avoid undercharging.
      pixels = (shortEdge * shortEdge * 5) / 2;
    } else {
      const [width, height] = request.resolution.split('x').map(Number);
      pixels = width * height;
    }

    const priceTenthsPerMillion =
      request.videoResolution === '1080p' ? 117 : 107;
    // tokens = duration * pixels * 24fps / 1024. One token costs the same
    // numeric number of USD micros as its $/million-token rate. Aggregate the
    // whole clip before the single upward rounding.
    return Math.ceil(
      (request.duration * pixels * 24 * priceTenthsPerMillion) /
        (1024 * 10),
    );
  }

  const rate =
    VIDEO_USD_MICROS_PER_SECOND[request.modelId]?.[
      request.videoResolution
    ];
  if (rate === undefined) {
    throw new VideoGenerationValidationError(
      'This video pricing combination is not supported.',
    );
  }
  const usdMicrosPerSecond =
    typeof rate === 'number'
      ? rate
      : request.generateAudio
        ? rate.audio
        : rate.silent;
  const referenceInputMicros =
    request.modelId === 'spacexai/grok-imagine-video-1.5' &&
    request.hasReferenceImage
      ? 10_000
      : 0;
  return request.duration * usdMicrosPerSecond + referenceInputMicros;
}

export function buildStudioVideoGeneratePayload(input: {
  prompt: string;
  request: NormalizedStudioVideoRequest;
}): StudioVideoGeneratePayload {
  const { request } = input;
  return {
    model: request.modelId,
    prompt: request.referenceImage
      ? { image: request.referenceImage, text: input.prompt }
      : input.prompt,
    aspectRatio: request.aspect,
    duration: request.duration,
    resolution: request.resolution,
    // Only models that expose an audio switch accept this top-level option.
    // MiniMax, Grok and Veo Lite generate native audio automatically.
    ...(STUDIO_VIDEO_CONTRACTS[request.modelId].audioMode === 'optional'
      ? { generateAudio: request.generateAudio }
      : {}),
    // A video generation is billable. The route owns request idempotency, so
    // the SDK must not create another generation through an automatic retry.
    maxRetries: 0,
  };
}
