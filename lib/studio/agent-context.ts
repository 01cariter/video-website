import type { FileUIPart, UIMessage } from 'ai';
import {
  studioSkillById,
  type StudioSkillId,
} from './skills/catalog';
import type {
  StudioCanvasOperation,
  StudioGenStatus,
  StudioNode,
  StudioNodeKind,
  StudioOperationParameter,
} from './types';

const NODE_KINDS = new Set<StudioNodeKind>([
  'image',
  'video',
  'text',
  'section',
]);
const NODE_STATUSES = new Set<StudioGenStatus>([
  'idle',
  'uploading',
  'generating',
  'ready',
  'error',
]);
const PARAMETER_KEYS = [
  'aspect',
  'size',
  'n',
  'quality',
  'resolution',
  'imageSize',
  'style',
  'thinkingLevel',
  'duration',
  'videoResolution',
  'generateAudio',
  'reasoningEffort',
] as const;

type StudioParameterValue = string | number | boolean;

export interface CanvasNodeSnapshot {
  id: string;
  kind: StudioNodeKind;
  title: string;
  prompt: string;
  text?: string;
  status: StudioGenStatus;
  modelId?: string;
  parameters?: Record<string, StudioParameterValue>;
  hasAsset: boolean;
  selected?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export const MAX_SELECTED_CANVAS_NODES = 50;
export const MAX_STUDIO_AGENT_FILE_ATTACHMENTS = 8;

export interface StudioAgentAttachment {
  id: string;
  kind: StudioNodeKind;
  title: string;
  previewUrl?: string;
  status?: StudioGenStatus;
  source?: 'canvas' | 'upload';
  modelId?: string;
}

export interface StudioAgentSkillAttachment {
  id: StudioSkillId;
  name: string;
  category: string;
}

export interface StudioAgentMessageMetadata {
  studioContext?: {
    attachments: StudioAgentAttachment[];
    skills: StudioAgentSkillAttachment[];
  };
  studioRun?: {
    workflowId: string;
    status: 'completed' | 'failed';
  };
}

export type StudioAgentUIMessage = UIMessage<StudioAgentMessageMetadata>;

export interface StudioToolOperationReceipt {
  toolCallId: string;
  operationIndex: number;
  operationId: string;
}

function boundedText(value: unknown, limit: number) {
  return typeof value === 'string' ? value.slice(0, limit) : '';
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function httpUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  return /^https?:\/\//i.test(value) ? value : undefined;
}

function nodeParameters(node: StudioNode) {
  const parameters: Record<string, StudioParameterValue> = {};
  for (const key of PARAMETER_KEYS) {
    const value = node.data[key];
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      parameters[key] = value;
    }
  }
  return parameters;
}

/** Creates a compact, request-frozen canvas context with selected nodes first. */
export function buildCanvasNodeSnapshots(
  nodes: StudioNode[],
  selectedIds: readonly string[],
) {
  const selected = new Set(selectedIds);
  const ordered = [
    ...nodes.filter((node) => selected.has(node.id)),
    ...nodes.filter((node) => !selected.has(node.id)),
  ].slice(0, 200);

  return ordered.map((node): CanvasNodeSnapshot => {
    const isSelected = selected.has(node.id);
    const parameters = isSelected ? nodeParameters(node) : undefined;
    return {
      id: node.id,
      kind: node.type,
      title: boundedText(node.data.title, 120),
      prompt: boundedText(node.data.prompt, isSelected ? 4000 : 240),
      text:
        isSelected && node.type === 'text'
          ? boundedText(node.data.text, 8000)
          : undefined,
      status: node.data.status,
      modelId:
        isSelected && typeof node.data.modelId === 'string'
          ? node.data.modelId.slice(0, 160)
          : undefined,
      parameters:
        parameters && Object.keys(parameters).length ? parameters : undefined,
      hasAsset: Boolean(node.data.src || node.data.text?.trim()),
      selected: isSelected,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
  });
}

export function attachmentsForStudioNodes(
  nodes: StudioNode[],
  ids: readonly string[],
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return ids
    .slice(0, MAX_SELECTED_CANVAS_NODES)
    .flatMap((id): StudioAgentAttachment[] => {
      const node = byId.get(id);
      if (!node) return [];
      return [
        {
          id: node.id,
          kind: node.type,
          title: node.data.title || node.type,
          previewUrl: httpUrl(
            node.type === 'video'
              ? node.data.posterSrc || node.data.src
              : node.data.src,
          ),
          status: node.data.status,
          source: node.data.uploadMime ? 'upload' : 'canvas',
          modelId:
            typeof node.data.modelId === 'string'
              ? node.data.modelId.slice(0, 160)
              : undefined,
        },
      ];
    });
}

export function filePartsForStudioNodes(
  nodes: StudioNode[],
  ids: readonly string[],
): FileUIPart[] {
  return attachmentsForStudioNodes(nodes, ids)
    .filter(
      (attachment) =>
        Boolean(attachment.previewUrl) &&
        (attachment.kind === 'image' || attachment.kind === 'video'),
    )
    .slice(0, MAX_STUDIO_AGENT_FILE_ATTACHMENTS)
    .map((attachment) => ({
      type: 'file',
      filename: attachment.title.slice(0, 120),
      mediaType: 'image',
      url: attachment.previewUrl!,
    }));
}

export function buildStudioAgentMessageMetadata(
  nodes: StudioNode[],
  attachmentIds: readonly string[],
  skillIds: readonly StudioSkillId[],
): StudioAgentMessageMetadata {
  return {
    studioContext: {
      attachments: attachmentsForStudioNodes(nodes, attachmentIds),
      skills: skillIds.map((id) => {
        const skill = studioSkillById(id);
        return { id, name: skill.name, category: skill.category };
      }),
    },
  };
}

export function studioAgentMessageContext(message: UIMessage) {
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== 'object') return undefined;
  const context = (metadata as StudioAgentMessageMetadata).studioContext;
  if (!context || !Array.isArray(context.attachments) || !Array.isArray(context.skills)) {
    return undefined;
  }
  return context;
}

export function normalizeCanvasNodeSnapshots(
  value: unknown,
): CanvasNodeSnapshot[] | null {
  if (!Array.isArray(value) || value.length > 200) return null;
  const snapshots: CanvasNodeSnapshot[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const node = item as Record<string, unknown>;
    const id = boundedText(node.id, 160);
    const kind = node.kind as StudioNodeKind;
    const status = boundedText(node.status, 40) as StudioGenStatus;
    if (
      !id ||
      seen.has(id) ||
      !NODE_KINDS.has(kind) ||
      !NODE_STATUSES.has(status)
    ) {
      return null;
    }
    seen.add(id);

    let parameters: Record<string, StudioParameterValue> | undefined;
    if (node.parameters !== undefined) {
      if (!node.parameters || typeof node.parameters !== 'object') return null;
      parameters = {};
      const entries = Object.entries(node.parameters).slice(0, 20);
      for (const [key, parameter] of entries) {
        if (!PARAMETER_KEYS.includes(key as (typeof PARAMETER_KEYS)[number])) {
          continue;
        }
        if (
          typeof parameter !== 'string' &&
          typeof parameter !== 'number' &&
          typeof parameter !== 'boolean'
        ) {
          return null;
        }
        parameters[key] = parameter;
      }
    }

    snapshots.push({
      id,
      kind,
      title: boundedText(node.title, 120),
      prompt: boundedText(node.prompt, 4000),
      text: node.text === undefined ? undefined : boundedText(node.text, 8000),
      status,
      modelId:
        node.modelId === undefined
          ? undefined
          : boundedText(node.modelId, 160) || undefined,
      parameters,
      hasAsset: node.hasAsset === true,
      x: finiteNumber(node.x),
      y: finiteNumber(node.y),
      width: finiteNumber(node.width),
      height: finiteNumber(node.height),
    });
  }

  return snapshots;
}

export function normalizeSelectedCanvasIds(
  value: unknown,
  canvas: readonly CanvasNodeSnapshot[],
): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_SELECTED_CANVAS_NODES) {
    return null;
  }
  const available = new Set(canvas.map((node) => node.id));
  const selected: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length > 160) return null;
    if (!available.has(item)) return null;
    if (!selected.includes(item)) selected.push(item);
  }
  return selected;
}

export function markSelectedCanvasNodes(
  canvas: CanvasNodeSnapshot[],
  selectedIds: readonly string[],
) {
  const selected = new Set(selectedIds);
  return [
    ...canvas.filter((node) => selected.has(node.id)),
    ...canvas.filter((node) => !selected.has(node.id)),
  ].map((node) => ({ ...node, selected: selected.has(node.id) }));
}

export function canvasInventoryText(canvas: CanvasNodeSnapshot[]) {
  if (!canvas.length) return 'The canvas is currently empty.';
  const rows = canvas.map((node) => {
    const details = [
      `status: ${node.status}`,
      `position: ${Math.round(node.x || 0)},${Math.round(node.y || 0)}`,
      node.prompt ? `prompt: ${node.prompt}` : null,
      node.text ? `text: ${node.text}` : null,
      node.modelId ? `model: ${node.modelId}` : null,
      node.parameters
        ? `parameters: ${JSON.stringify(node.parameters)}`
        : null,
      node.hasAsset ? 'has content' : 'no generated content',
    ].filter(Boolean);
    return `- ${node.selected ? '[SELECTED] ' : ''}${node.kind} ${node.id} "${node.title}" — ${details.join('; ')}`;
  });
  return rows.join('\n');
}

function hashReceipt(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function studioAgentOperationId(toolCallId: string, index = 0) {
  return `agent-${hashReceipt(`${toolCallId}:${index}`)}-${index}`;
}

function optionalString(value: unknown, limit: number) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  return value.slice(0, limit);
}

function optionalGeometry(value: unknown) {
  if (value === undefined) return undefined;
  return finiteNumber(value) ?? null;
}

function optionalBoolean(value: unknown) {
  if (value === undefined) return undefined;
  return typeof value === 'boolean' ? value : null;
}

function optionalStringArray(value: unknown, limit: number) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > limit) return null;
  const values: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item || item.length > 160) return null;
    if (!values.includes(item)) values.push(item);
  }
  return values;
}

function optionalParameters(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const parameters: Record<string, StudioOperationParameter> = {};
  const entries = Object.entries(value).slice(0, 20);
  for (const [key, parameter] of entries) {
    if (key.length > 60) return null;
    if (
      typeof parameter !== 'string' &&
      typeof parameter !== 'number' &&
      typeof parameter !== 'boolean'
    ) {
      return null;
    }
    if (typeof parameter === 'number' && !Number.isFinite(parameter)) {
      return null;
    }
    parameters[key] = parameter;
  }
  return parameters;
}

function operationFromValue(value: unknown): StudioCanvasOperation | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;

  if (candidate.type === 'add_node') {
    if (!candidate.node || typeof candidate.node !== 'object') return null;
    const node = candidate.node as Record<string, unknown>;
    if (!NODE_KINDS.has(node.kind as StudioNodeKind)) return null;
    const id = optionalString(node.id, 160);
    const prompt = optionalString(node.prompt, 4000);
    const title = optionalString(node.title, 120);
    const text = optionalString(node.text, 8000);
    const x = optionalGeometry(node.x);
    const y = optionalGeometry(node.y);
    const width = optionalGeometry(node.width);
    const height = optionalGeometry(node.height);
    const modelId = optionalString(node.modelId, 160);
    const parameters = optionalParameters(node.parameters);
    const autoGenerate = optionalBoolean(node.autoGenerate);
    const dependsOn = optionalStringArray(node.dependsOn, 24);
    const referenceNodeIds = optionalStringArray(node.referenceNodeIds, 8);
    const groupId = optionalString(node.groupId, 160);
    const groupIndex = optionalGeometry(node.groupIndex);
    if (
      [
        id,
        prompt,
        title,
        text,
        x,
        y,
        width,
        height,
        modelId,
        parameters,
        autoGenerate,
        dependsOn,
        referenceNodeIds,
        groupId,
        groupIndex,
      ].includes(null)
    ) {
      return null;
    }
    return {
      type: 'add_node',
      node: {
        id: id || undefined,
        kind: node.kind as StudioNodeKind,
        prompt: prompt || undefined,
        title: title || undefined,
        text: text || undefined,
        x: x ?? undefined,
        y: y ?? undefined,
        width: width ?? undefined,
        height: height ?? undefined,
        modelId: modelId || undefined,
        parameters: parameters || undefined,
        autoGenerate: autoGenerate ?? undefined,
        dependsOn: dependsOn || undefined,
        referenceNodeIds: referenceNodeIds || undefined,
        groupId: groupId || undefined,
        groupIndex: groupIndex ?? undefined,
      },
    };
  }

  if (candidate.type === 'create_variant') {
    const id = optionalString(candidate.id, 160);
    const sourceId = optionalString(candidate.sourceId, 160);
    const prompt = optionalString(candidate.prompt, 4000);
    const title = optionalString(candidate.title, 120);
    const autoGenerate = optionalBoolean(candidate.autoGenerate);
    if (!sourceId || [id, prompt, title, autoGenerate].includes(null)) {
      return null;
    }
    return {
      type: 'create_variant',
      id: id || undefined,
      sourceId,
      prompt: prompt || undefined,
      title: title || undefined,
      autoGenerate: autoGenerate ?? undefined,
    };
  }

  if (candidate.type === 'update_node') {
    if (
      typeof candidate.id !== 'string' ||
      candidate.id.length > 160 ||
      !candidate.patch ||
      typeof candidate.patch !== 'object'
    ) {
      return null;
    }
    const raw = candidate.patch as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const key of ['title', 'prompt', 'text'] as const) {
      const parsed = optionalString(raw[key], key === 'text' ? 8000 : 4000);
      if (parsed === null) return null;
      if (parsed !== undefined) patch[key] = parsed;
    }
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      const parsed = optionalGeometry(raw[key]);
      if (parsed === null) return null;
      if (parsed !== undefined) patch[key] = parsed;
    }
    return {
      type: 'update_node',
      id: candidate.id,
      patch,
    };
  }

  if (
    typeof candidate.kind === 'string' &&
    NODE_KINDS.has(candidate.kind as StudioNodeKind)
  ) {
    return operationFromValue({ type: 'add_node', node: candidate });
  }
  return null;
}

export function canvasOperationsFromOutput(output: unknown) {
  if (!output || typeof output !== 'object') return [];
  const value = output as Record<string, unknown>;
  const values = Array.isArray(value.operations)
    ? value.operations
    : value.operation
      ? [value.operation]
      : [value];
  return values.flatMap((operation) => {
    const parsed = operationFromValue(operation);
    return parsed ? [parsed] : [];
  });
}

export function applyNewStudioToolOutputs(
  messages: UIMessage[],
  seen: Set<string>,
  applyOperation: (
    operation: StudioCanvasOperation,
    receipt: StudioToolOperationReceipt,
  ) => void,
) {
  const appliedToolCallIds: string[] = [];
  for (const message of messages) {
    for (const part of message.parts) {
      if (!part.type.startsWith('tool-')) continue;
      const toolCallId = 'toolCallId' in part ? String(part.toolCallId) : '';
      const state = 'state' in part ? String(part.state) : '';
      if (!toolCallId || seen.has(toolCallId) || state !== 'output-available') {
        continue;
      }
      const output = 'output' in part ? part.output : null;
      const operations = canvasOperationsFromOutput(output);
      if (!operations.length) {
        seen.add(toolCallId);
        continue;
      }
      try {
        operations.forEach((operation, operationIndex) => {
          const operationId = studioAgentOperationId(toolCallId, operationIndex);
          const stableOperation =
            operation.type === 'add_node' && !operation.node.id
              ? {
                  ...operation,
                  node: { ...operation.node, id: operationId },
                }
              : operation.type === 'create_variant' && !operation.id
                ? { ...operation, id: operationId }
                : operation;
          applyOperation(stableOperation, {
            toolCallId,
            operationIndex,
            operationId,
          });
        });
        seen.add(toolCallId);
        appliedToolCallIds.push(toolCallId);
      } catch {
        // Keep the tool call retryable until its canvas mutation succeeds.
      }
    }
  }
  return appliedToolCallIds;
}
