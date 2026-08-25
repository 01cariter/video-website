import {
  STUDIO_MODEL_SPECS,
  type CatalogField,
} from '../lib/studio/model-catalog';
import { STUDIO_IMAGE_MODEL_IDS } from '../lib/studio/image-generation';
import { STUDIO_VIDEO_MODEL_IDS } from '../lib/studio/video-generation';

interface GatewayVideoCapabilities {
  supported_operations?: string[];
  supported_resolutions?: string[];
  supported_aspect_ratios?: string[];
  supported_durations_seconds?: number[];
  generate_audio?: boolean;
  input_limits?: { image?: { max_count?: number } };
}

interface GatewayCatalogModel {
  id: string;
  type: string;
  video_capabilities?: GatewayVideoCapabilities;
}

function fieldValues(
  field: CatalogField | undefined,
): Array<string | number> {
  if (!field) return [];
  if (field.type === 'aspect') return field.options;
  if (field.type === 'enum') return field.options.map((option) => option.id);
  if (field.type === 'range') {
    const values: number[] = [];
    for (let value = field.min; value <= field.max; value += field.step) {
      values.push(value);
    }
    return values;
  }
  return [];
}

function missingValues(
  configured: Array<string | number>,
  available: Array<string | number> | undefined,
) {
  const supported = new Set(available ?? []);
  return configured.filter((value) => !supported.has(value));
}

async function main() {
  const response = await fetch('https://ai-gateway.vercel.sh/v1/models');
  if (!response.ok) {
    throw new Error(`Vercel model catalog returned HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as { data?: GatewayCatalogModel[] };
  const catalog = new Map(
    (payload.data ?? []).map((model) => [model.id, model]),
  );
  const errors: string[] = [];

  for (const modelId of STUDIO_IMAGE_MODEL_IDS) {
    const model = catalog.get(modelId);
    const expectedType =
      modelId === 'google/gemini-3.1-flash-image' ? 'language' : 'image';
    if (!model) {
      errors.push(`${modelId}: missing from the Vercel catalog`);
    } else if (model.type !== expectedType) {
      errors.push(`${modelId}: expected ${expectedType}, received ${model.type}`);
    }
  }

  for (const modelId of STUDIO_VIDEO_MODEL_IDS) {
    const model = catalog.get(modelId);
    if (!model) {
      errors.push(`${modelId}: missing from the Vercel catalog`);
      continue;
    }
    if (model.type !== 'video') {
      errors.push(`${modelId}: expected video, received ${model.type}`);
      continue;
    }

    const spec = STUDIO_MODEL_SPECS[modelId];
    const capabilities = model.video_capabilities;
    if (!spec || !capabilities) {
      errors.push(`${modelId}: missing local or Gateway video capabilities`);
      continue;
    }

    const checks: Array<[string, Array<string | number>]> = [
      [
        'aspect ratios',
        missingValues(
          fieldValues(spec.fields.find((field) => field.key === 'aspect')),
          capabilities.supported_aspect_ratios,
        ),
      ],
      [
        'resolutions',
        missingValues(
          fieldValues(
            spec.fields.find((field) => field.key === 'videoResolution'),
          ),
          capabilities.supported_resolutions,
        ),
      ],
      [
        'durations',
        missingValues(
          fieldValues(spec.fields.find((field) => field.key === 'duration')),
          capabilities.supported_durations_seconds,
        ),
      ],
    ];
    for (const [label, missing] of checks) {
      if (missing.length) {
        errors.push(`${modelId}: unsupported ${label}: ${missing.join(', ')}`);
      }
    }

    const gatewayReferenceLimit = capabilities.input_limits?.image?.max_count;
    if (
      spec.maxRefs > 0 &&
      (!capabilities.supported_operations?.includes('image-to-video') ||
        gatewayReferenceLimit === undefined ||
        spec.maxRefs > gatewayReferenceLimit)
    ) {
      errors.push(
        `${modelId}: local reference-image limit exceeds Gateway capabilities`,
      );
    }

    const hasAudioToggle = spec.fields.some(
      (field) => field.key === 'generateAudio',
    );
    if (hasAudioToggle && capabilities.generate_audio !== true) {
      errors.push(`${modelId}: exposes an unsupported audio toggle`);
    }
  }

  if (errors.length) {
    throw new Error(`Studio model audit failed:\n${errors.join('\n')}`);
  }

  console.log(
    `Verified ${STUDIO_IMAGE_MODEL_IDS.length} image and ${STUDIO_VIDEO_MODEL_IDS.length} video models against the live Vercel catalog.`,
  );
}

void main();
