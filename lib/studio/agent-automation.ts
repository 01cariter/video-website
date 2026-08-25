import type { StudioNode } from './types';

export type StudioAutomationAction =
  | { type: 'wait' }
  | { type: 'fail'; error: string }
  | { type: 'start'; references: string[] };

function stringIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string' && Boolean(id))
    : [];
}

export function resolveStudioAutomationAction(
  node: StudioNode,
  nodes: readonly StudioNode[],
): StudioAutomationAction {
  if (
    node.type === 'section' ||
    node.data.agentAutoGenerate !== true ||
    node.data.status !== 'idle'
  ) {
    return { type: 'wait' };
  }
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const dependencyIds = stringIds(node.data.agentDependsOn);
  const referenceIds = stringIds(node.data.agentReferenceNodeIds);
  const requiredIds = [...new Set([...dependencyIds, ...referenceIds])];
  const dependencies = requiredIds.map((id) => byId.get(id));
  if (dependencies.some((dependency) => !dependency)) return { type: 'wait' };
  const failed = dependencies.find(
    (dependency) => dependency?.data.status === 'error',
  );
  if (failed) {
    return {
      type: 'fail',
      error: `Dependency “${failed.data.title}” failed. Fix or regenerate it to continue this workflow.`,
    };
  }
  if (dependencies.some((dependency) => dependency?.data.status !== 'ready')) {
    return { type: 'wait' };
  }

  const references = referenceIds.flatMap((id) => {
    const dependency = byId.get(id);
    const src = dependency?.data.src;
    return typeof src === 'string' && src ? [src] : [];
  });
  if (references.length !== referenceIds.length) {
    return {
      type: 'fail',
      error: 'A required image dependency completed without a usable asset.',
    };
  }
  return { type: 'start', references };
}

export function workflowGroupPosition(
  group: Pick<StudioNode, 'x' | 'y'>,
  index: number,
) {
  const column = Math.max(0, Math.trunc(index)) % 3;
  const row = Math.floor(Math.max(0, Math.trunc(index)) / 3);
  return {
    x: group.x + 24 + column * 324,
    y: group.y + 52 + row * 460,
  };
}
