import {
  isStudioModelAvailable,
  modelOptionsForKind,
  modelSpecFor,
  resolveStudioModel,
  type CatalogField,
} from './model-catalog';
import { studioAgentOperationId } from './agent-context';
import type { StudioRuntimeConfig } from './pricing';
import type {
  StudioCanvasOperation,
  StudioGenerativeKind,
  StudioOperationParameter,
} from './types';

export interface StudioAgentWorkflowNodeInput {
  key: string;
  kind: StudioGenerativeKind;
  title?: string;
  prompt: string;
  text?: string;
  modelId?: string;
  parameters?: Record<string, StudioOperationParameter>;
  dependsOn?: string[];
  referenceNodeIds?: string[];
  generate?: boolean;
}

export interface StudioAgentWorkflowInput {
  title?: string;
  groupTitle?: string;
  nodes: StudioAgentWorkflowNodeInput[];
}

export interface StudioAgentWorkflowNodeReceipt {
  id: string;
  key: string;
  kind: StudioGenerativeKind;
  title: string;
  modelId: string;
  dependsOn: string[];
  autoGenerate: boolean;
}

export interface StudioAgentWorkflowReceipt {
  id: string;
  title: string;
  groupId?: string;
  nodes: StudioAgentWorkflowNodeReceipt[];
}

function roundedRangeValue(
  field: Extract<CatalogField, { type: 'range' }>,
  value: unknown,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const stepped =
    field.min + Math.round((value - field.min) / field.step) * field.step;
  return Math.min(field.max, Math.max(field.min, stepped));
}

function normalizedFieldValue(field: CatalogField, value: unknown) {
  if (field.type === 'toggle') {
    return typeof value === 'boolean' ? value : undefined;
  }
  if (field.type === 'range') return roundedRangeValue(field, value);
  if (field.type === 'stepper') {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.min(field.max, Math.max(field.min, Math.round(value)))
      : undefined;
  }
  if (field.type === 'aspect') {
    return typeof value === 'string' && field.options.includes(value)
      ? value
      : undefined;
  }
  return typeof value === 'string' &&
    field.options.some((option) => option.id === value)
    ? value
    : undefined;
}

export function normalizeStudioWorkflowParameters(
  kind: StudioGenerativeKind,
  modelId: string,
  parameters: Record<string, StudioOperationParameter> | undefined,
  runtime: StudioRuntimeConfig,
) {
  const spec = modelSpecFor(kind, modelId, runtime);
  const normalized: Record<string, StudioOperationParameter> = {
    ...spec.defaults,
  };
  for (const field of spec.fields) {
    const value = normalizedFieldValue(field, parameters?.[field.key]);
    if (value !== undefined) normalized[field.key] = value;
  }
  return normalized;
}

function inferredWorkflowParameters(
  node: StudioAgentWorkflowNodeInput,
  runtime: StudioRuntimeConfig,
) {
  const model = resolveStudioModel(node.kind, node.modelId, runtime);
  const spec = modelSpecFor(node.kind, model.id, runtime);
  const context = `${node.title ?? ''} ${node.prompt}`.toLowerCase();
  const inferred: Record<string, StudioOperationParameter> = {};
  const aspectField = spec.fields.find((field) => field.type === 'aspect');
  if (aspectField?.type === 'aspect') {
    const explicitAspect = context.match(
      /(?:^|\s)(21:9|16:9|9:16|4:3|3:4|1:1|3:2|2:3)(?:\s|$|[,.])/,
    )?.[1];
    const desiredAspect = explicitAspect
      ? explicitAspect
      : /vertical|portrait|short[- ]form|reel|tiktok|竖屏|纵向/.test(context)
        ? '9:16'
        : /storyboard|shot|cinematic|widescreen|film|video|分镜|镜头|横屏/.test(
              context,
            )
          ? '16:9'
          : undefined;
    if (desiredAspect && aspectField.options.includes(desiredAspect)) {
      inferred.aspect = desiredAspect;
    }
  }

  const durationField = spec.fields.find(
    (field) => field.type === 'range' && field.key === 'duration',
  );
  if (durationField?.type === 'range') {
    const seconds = context.match(/(\d{1,2})\s*(?:seconds?|secs?|s|秒)/)?.[1];
    if (seconds) inferred.duration = Number(seconds);
  }
  const resolutionField = spec.fields.find(
    (field) => field.type === 'enum' && field.key === 'videoResolution',
  );
  if (resolutionField?.type === 'enum') {
    const requested = context.match(/(?:^|\s)(480p|720p|1080p|2k|4k)(?:\s|$|[,.])/i)?.[1];
    if (requested) inferred.videoResolution = requested.toLowerCase();
  }
  for (const key of ['resolution', 'imageSize'] as const) {
    const field = spec.fields.find(
      (candidate) => candidate.type === 'enum' && candidate.key === key,
    );
    if (field?.type !== 'enum') continue;
    const requested = context.match(/(?:^|\s)(512|1k|2k|4k)(?:\s|$|[,.])/i)?.[1];
    const option = field.options.find(
      (candidate) => candidate.id.toLowerCase() === requested?.toLowerCase(),
    );
    if (option) inferred[key] = option.id;
  }
  if (spec.fields.some((field) => field.key === 'generateAudio')) {
    if (/with (?:sound|audio)|dialogue|music|有声|声音|对白|音乐/.test(context)) {
      inferred.generateAudio = true;
    }
  }
  return inferred;
}

function unique(values: readonly string[] | undefined) {
  return [...new Set((values ?? []).filter(Boolean))];
}

function assertAcyclic(
  nodes: readonly StudioAgentWorkflowNodeInput[],
  dependencies: Map<string, string[]>,
) {
  const keys = new Set(nodes.map((node) => node.key));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (key: string) => {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw new Error('The Agent workflow contains a dependency cycle.');
    }
    visiting.add(key);
    for (const dependency of dependencies.get(key) ?? []) {
      if (keys.has(dependency)) visit(dependency);
    }
    visiting.delete(key);
    visited.add(key);
  };

  for (const node of nodes) visit(node.key);
}

function defaultNodeTitle(node: StudioAgentWorkflowNodeInput) {
  return (
    node.title?.trim() ||
    (node.kind === 'image'
      ? 'Image generation'
      : node.kind === 'video'
        ? 'Video generation'
        : 'Text')
  ).slice(0, 80);
}

export function buildStudioAgentWorkflow(input: {
  workflow: StudioAgentWorkflowInput;
  toolCallId: string;
  canvasNodeIds: readonly string[];
  runtime: StudioRuntimeConfig;
}) {
  const { workflow, toolCallId, runtime } = input;
  if (!workflow.nodes.length) {
    throw new Error('The Agent workflow needs at least one node.');
  }
  const keys = workflow.nodes.map((node) => node.key.trim());
  if (keys.some((key) => !/^[a-zA-Z0-9_-]{1,64}$/.test(key))) {
    throw new Error('Workflow node keys must be short letters, numbers, dashes, or underscores.');
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error('Workflow node keys must be unique.');
  }

  const normalizedNodes = workflow.nodes.map((node, index) => ({
    ...node,
    key: keys[index],
    prompt: node.prompt.trim(),
  }));
  if (normalizedNodes.some((node) => !node.prompt)) {
    throw new Error('Every generated workflow node needs a prompt.');
  }

  const dependencies = new Map(
    normalizedNodes.map((node) => [
      node.key,
      unique([...(node.dependsOn ?? []), ...(node.referenceNodeIds ?? [])]),
    ]),
  );
  const availableReferences = new Set([
    ...keys,
    ...input.canvasNodeIds,
  ]);
  for (const values of dependencies.values()) {
    const unknown = values.find((value) => !availableReferences.has(value));
    if (unknown) {
      throw new Error(`Workflow dependency "${unknown}" does not exist.`);
    }
  }
  assertAcyclic(normalizedNodes, dependencies);

  const grouped = normalizedNodes.length > 1 || Boolean(workflow.groupTitle);
  const groupId = grouped ? studioAgentOperationId(toolCallId, 0) : undefined;
  const operationOffset = grouped ? 1 : 0;
  const idsByKey = new Map(
    normalizedNodes.map((node, index) => [
      node.key,
      studioAgentOperationId(toolCallId, index + operationOffset),
    ]),
  );
  const canvasNodeIds = new Set(input.canvasNodeIds);
  const resolveNodeId = (value: string) =>
    idsByKey.get(value) ?? (canvasNodeIds.has(value) ? value : undefined);

  const receipts: StudioAgentWorkflowNodeReceipt[] = [];
  const operations: StudioCanvasOperation[] = [];
  if (groupId) {
    const columns = Math.min(3, normalizedNodes.length);
    const rows = Math.ceil(normalizedNodes.length / columns);
    operations.push({
      type: 'add_node',
      node: {
        id: groupId,
        kind: 'section',
        title: (workflow.groupTitle || workflow.title || 'Agent workflow').slice(
          0,
          80,
        ),
        width: 48 + columns * 300 + Math.max(0, columns - 1) * 24,
        height: 72 + rows * 460,
      },
    });
  }

  normalizedNodes.forEach((node, index) => {
    const model = resolveStudioModel(node.kind, node.modelId, runtime);
    const spec = modelSpecFor(node.kind, model.id, runtime);
    const dependencyIds = unique(
      (dependencies.get(node.key) ?? []).flatMap((value) => {
        const id = resolveNodeId(value);
        return id ? [id] : [];
      }),
    );
    const referenceNodeIds = unique(
      (node.referenceNodeIds ?? []).flatMap((value) => {
        const id = resolveNodeId(value);
        return id ? [id] : [];
      }),
    ).slice(0, spec.maxRefs);
    const autoGenerate = node.generate !== false;
    const id = idsByKey.get(node.key)!;
    const title = defaultNodeTitle(node);
    operations.push({
      type: 'add_node',
      node: {
        id,
        kind: node.kind,
        title,
        prompt: node.prompt.slice(0, 4000),
        text: node.text?.slice(0, 8000),
        modelId: model.id,
        parameters: normalizeStudioWorkflowParameters(
          node.kind,
          model.id,
          {
            ...inferredWorkflowParameters(node, runtime),
            ...node.parameters,
          },
          runtime,
        ),
        autoGenerate,
        dependsOn: dependencyIds,
        referenceNodeIds,
        groupId,
        groupIndex: groupId ? index : undefined,
      },
    });
    receipts.push({
      id,
      key: node.key,
      kind: node.kind,
      title,
      modelId: model.id,
      dependsOn: dependencyIds,
      autoGenerate,
    });
  });

  return {
    workflow: {
      id: toolCallId,
      title: (workflow.title || workflow.groupTitle || 'Creative workflow').slice(
        0,
        120,
      ),
      groupId,
      nodes: receipts,
    } satisfies StudioAgentWorkflowReceipt,
    operations,
  };
}

function fieldContract(field: CatalogField) {
  if (field.type === 'toggle') return `${field.key}=boolean`;
  if (field.type === 'range') {
    return `${field.key}=${field.min}..${field.max}${field.unit}`;
  }
  if (field.type === 'stepper') {
    return `${field.key}=${field.min}..${field.max}`;
  }
  const values =
    field.type === 'aspect'
      ? field.options
      : field.options.map((option) => option.id);
  return `${field.key}=[${values.join('|')}]`;
}

export function studioAgentModelContractText(runtime: StudioRuntimeConfig) {
  return (['image', 'video', 'text'] as const)
    .flatMap((kind) =>
      modelOptionsForKind(kind)
        .filter((model) => isStudioModelAvailable(model, runtime))
        .map((model) => {
          const spec = modelSpecFor(kind, model.id, runtime);
          const fields = spec.fields.map(fieldContract).join(', ');
          return `- ${kind}: ${model.label} => ${model.id}${fields ? ` (${fields})` : ''}; references=${spec.maxRefs}`;
        }),
    )
    .join('\n');
}
