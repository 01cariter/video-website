import type { StudioAgentWorkflowReceipt } from '@/lib/studio/agent-workflow';
import type { StudioNode } from '@/lib/studio/types';

export function workflowReceiptFromPart(
  part: unknown,
): StudioAgentWorkflowReceipt | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const candidate = part as Record<string, unknown>;
  if (
    typeof candidate.type !== 'string' ||
    !candidate.type.startsWith('tool-') ||
    !('output' in candidate)
  ) {
    return undefined;
  }
  const output = candidate.output;
  if (!output || typeof output !== 'object') return undefined;
  const workflow = (output as { workflow?: unknown }).workflow;
  if (!workflow || typeof workflow !== 'object') return undefined;
  const value = workflow as Record<string, unknown>;
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    !Array.isArray(value.nodes)
  ) {
    return undefined;
  }
  const nodes = value.nodes.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const node = item as Record<string, unknown>;
    if (
      typeof node.id !== 'string' ||
      typeof node.key !== 'string' ||
      !['image', 'video', 'text'].includes(String(node.kind)) ||
      typeof node.title !== 'string' ||
      typeof node.modelId !== 'string' ||
      !Array.isArray(node.dependsOn) ||
      node.dependsOn.some((id) => typeof id !== 'string') ||
      typeof node.autoGenerate !== 'boolean'
    ) {
      return [];
    }
    return [
      {
        id: node.id,
        key: node.key,
        kind: node.kind as 'image' | 'video' | 'text',
        title: node.title,
        modelId: node.modelId,
        dependsOn: node.dependsOn as string[],
        autoGenerate: node.autoGenerate,
      },
    ];
  });
  if (nodes.length !== value.nodes.length) return undefined;
  return {
    id: value.id,
    title: value.title,
    groupId: typeof value.groupId === 'string' ? value.groupId : undefined,
    nodes,
  };
}

export function workflowProgress(
  workflow: StudioAgentWorkflowReceipt,
  nodes: readonly StudioNode[],
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const statuses = workflow.nodes.map((receipt) => {
    const node = byId.get(receipt.id);
    return node?.data.status ?? 'idle';
  });
  const ready = statuses.filter((status) => status === 'ready').length;
  const errors = statuses.filter((status) => status === 'error').length;
  const running = statuses.filter(
    (status) => status === 'generating' || status === 'uploading',
  ).length;
  return {
    ready,
    errors,
    running,
    total: statuses.length,
    complete: statuses.length > 0 && ready === statuses.length,
  };
}
