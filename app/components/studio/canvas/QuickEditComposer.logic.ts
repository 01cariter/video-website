import {
  STUDIO_MODEL_SPECS,
  isStudioModelAvailable,
  modelOptionsForKind,
  modelSpecFor,
  resolveStudioModel,
  type StudioModelSpec,
} from '@/lib/studio/model-catalog';
import type { StudioRuntimeConfig } from '@/lib/studio/pricing';
import type { StudioNode, StudioNodeData } from '@/lib/studio/types';

function parsedRatio(value: unknown, separator: ':' | 'x') {
  if (typeof value !== 'string') return undefined;
  const [width, height] = value.split(separator).map(Number);
  if (!width || !height || width <= 0 || height <= 0) return undefined;
  return width / height;
}

function sourceRatio(node: StudioNode) {
  const sourceDimensionsRatio =
    typeof node.data.sourceWidth === 'number' &&
    typeof node.data.sourceHeight === 'number' &&
    node.data.sourceWidth > 0 &&
    node.data.sourceHeight > 0
      ? node.data.sourceWidth / node.data.sourceHeight
      : undefined;
  const sourceSpec =
    typeof node.data.modelId === 'string'
      ? STUDIO_MODEL_SPECS[node.data.modelId]
      : undefined;
  const supportsSize = sourceSpec?.fields.some(
    (field) => field.key === 'size',
  );
  const sizeRatio = supportsSize
    ? parsedRatio(node.data.size, 'x')
    : undefined;
  const aspectRatio = parsedRatio(node.data.aspect, ':');
  const geometryRatio =
    node.width > 0 && node.height > 0 ? node.width / node.height : undefined;
  return sourceDimensionsRatio ?? sizeRatio ?? aspectRatio ?? geometryRatio ?? 1;
}

function closestOption(
  options: string[],
  ratio: number,
  separator: ':' | 'x',
) {
  return options.reduce<string | undefined>((closest, option) => {
    const optionRatio = parsedRatio(option, separator);
    if (!optionRatio) return closest;
    if (!closest) return option;
    const closestRatio = parsedRatio(closest, separator);
    if (!closestRatio) return option;
    return Math.abs(Math.log(optionRatio / ratio)) <
      Math.abs(Math.log(closestRatio / ratio))
      ? option
      : closest;
  }, undefined);
}

function enumOptions(spec: StudioModelSpec, key: string) {
  const field = spec.fields.find(
    (candidate) => candidate.key === key && candidate.type === 'enum',
  );
  return field?.type === 'enum'
    ? field.options.map((option) => option.id)
    : [];
}

function aspectOptions(spec: StudioModelSpec) {
  const field = spec.fields.find(
    (candidate) => candidate.key === 'aspect' && candidate.type === 'aspect',
  );
  return field?.type === 'aspect' ? field.options : [];
}

function compatibleOutputCount(node: StudioNode, spec: StudioModelSpec) {
  const field = spec.fields.find(
    (candidate) => candidate.key === 'n' && candidate.type === 'stepper',
  );
  if (
    field?.type !== 'stepper' ||
    typeof node.data.n !== 'number' ||
    !Number.isInteger(node.data.n) ||
    node.data.n < field.min ||
    node.data.n > field.max
  ) {
    return undefined;
  }
  return node.data.n;
}

function mappedFallbackParameters(node: StudioNode, spec: StudioModelSpec) {
  const ratio = sourceRatio(node);
  const size = closestOption(enumOptions(spec, 'size'), ratio, 'x');
  const aspect = closestOption(aspectOptions(spec), ratio, ':');
  const n = compatibleOutputCount(node, spec);
  return {
    ...(size ? { size } : {}),
    ...(aspect ? { aspect } : {}),
    ...(n === undefined ? {} : { n }),
  };
}

function greatestCommonDivisor(left: number, right: number): number {
  return right ? greatestCommonDivisor(right, left % right) : left;
}

function outputAspect(
  spec: StudioModelSpec,
  values: Record<string, unknown>,
  fallbackRatio: number,
) {
  const size =
    spec.fields.some((field) => field.key === 'size') &&
    typeof values.size === 'string'
      ? values.size
      : undefined;
  if (size) {
    const [width, height] = size.split('x').map(Number);
    if (width > 0 && height > 0) {
      const divisor = greatestCommonDivisor(width, height);
      return `${width / divisor}:${height / divisor}`;
    }
  }
  if (
    spec.fields.some((field) => field.key === 'aspect') &&
    parsedRatio(values.aspect, ':')
  ) {
    return String(values.aspect);
  }
  return fallbackRatio > 1 ? '16:9' : fallbackRatio < 1 ? '9:16' : '1:1';
}

export function editModelId(node: StudioNode, runtime: StudioRuntimeConfig) {
  const current = resolveStudioModel('image', node.data.modelId, runtime);
  const currentSpec = modelSpecFor('image', current.id, runtime);
  if (isStudioModelAvailable(current, runtime) && currentSpec.maxRefs > 0) {
    return current.id;
  }
  return (
    modelOptionsForKind('image').find(
      (option) =>
        isStudioModelAvailable(option, runtime) &&
        modelSpecFor('image', option.id, runtime).maxRefs > 0,
    )?.id ?? current.id
  );
}

export function initialEditData(
  node: StudioNode,
  runtime: StudioRuntimeConfig,
) {
  const modelId = editModelId(node, runtime);
  const spec = modelSpecFor('image', modelId, runtime);
  const source = node.data.src?.trim();
  const sameModel = node.data.modelId === modelId;
  const inherited =
    sameModel
      ? Object.fromEntries(
          spec.fields.flatMap((field) =>
            node.data[field.key] === undefined
              ? []
              : [[field.key, node.data[field.key]]],
          ),
        )
      : {};
  const mapped = sameModel ? {} : mappedFallbackParameters(node, spec);
  const mappedSourceAspect = closestOption(
    aspectOptions(spec),
    sourceRatio(node),
    ':',
  );
  const values = {
    ...spec.defaults,
    ...inherited,
    ...mapped,
    ...(mappedSourceAspect ? { aspect: mappedSourceAspect } : {}),
  };
  return {
    ...node.data,
    ...values,
    modelId,
    aspect: outputAspect(spec, values, sourceRatio(node)),
    prompt: '',
    status: 'idle' as const,
    error: undefined,
    refSrc: source,
    refSrcs: source ? [source] : [],
  } satisfies StudioNodeData;
}

export function sourceReferences(
  source: string,
  sources: string[],
  maxRefs: number,
) {
  const extras = sources.filter(
    (value, index) =>
      Boolean(value) && value !== source && sources.indexOf(value) === index,
  );
  return source
    ? [source, ...extras.slice(0, Math.max(0, maxRefs - 1))]
    : extras.slice(0, maxRefs);
}

export function buildQuickEditParameters(
  draft: StudioNodeData,
  runtime: StudioRuntimeConfig,
  source: string,
): Partial<StudioNodeData> {
  const selectedModel = resolveStudioModel('image', draft.modelId, runtime);
  const spec = modelSpecFor('image', selectedModel.id, runtime);
  const refs = sourceReferences(source, draft.refSrcs ?? [], spec.maxRefs);
  const parameters = Object.fromEntries(
    spec.fields.map((field) => [field.key, draft[field.key]]),
  );
  return {
    ...parameters,
    aspect: outputAspect(spec, parameters, parsedRatio(draft.aspect, ':') ?? 1),
    modelId: selectedModel.id,
    refSrc: refs[0],
    refSrcs: refs,
  };
}
