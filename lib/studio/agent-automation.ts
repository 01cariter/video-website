import type { StudioNode } from './types';

export type StudioAutomationAction =
  | { type: 'wait' }
  | { type: 'fail'; error: string }
  | { type: 'start'; references: string[] };

const WORKFLOW_GRID_COLUMNS = 3;
const WORKFLOW_GRID_LEFT = 24;
const WORKFLOW_GRID_TOP = 72;
const WORKFLOW_GRID_RIGHT = 36;
const WORKFLOW_GRID_BOTTOM = 36;
const WORKFLOW_GRID_NODE_WIDTH = 300;
const WORKFLOW_GRID_NODE_HEIGHT = 300;
const WORKFLOW_GRID_STRIDE = 336;

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
  const normalizedIndex = Math.max(0, Math.trunc(index));
  const column = normalizedIndex % WORKFLOW_GRID_COLUMNS;
  const row = Math.floor(normalizedIndex / WORKFLOW_GRID_COLUMNS);
  return {
    x: group.x + WORKFLOW_GRID_LEFT + column * WORKFLOW_GRID_STRIDE,
    y: group.y + WORKFLOW_GRID_TOP + row * WORKFLOW_GRID_STRIDE,
  };
}

export function workflowGroupSize(nodeCount: number) {
  const count = Math.max(1, Math.trunc(nodeCount));
  const columns = Math.min(WORKFLOW_GRID_COLUMNS, count);
  const rows = Math.ceil(count / WORKFLOW_GRID_COLUMNS);
  return {
    width:
      WORKFLOW_GRID_LEFT +
      (columns - 1) * WORKFLOW_GRID_STRIDE +
      WORKFLOW_GRID_NODE_WIDTH +
      WORKFLOW_GRID_RIGHT,
    height:
      WORKFLOW_GRID_TOP +
      (rows - 1) * WORKFLOW_GRID_STRIDE +
      WORKFLOW_GRID_NODE_HEIGHT +
      WORKFLOW_GRID_BOTTOM,
  };
}
