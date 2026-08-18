import type { StudioNode, StudioNodeData, StudioNodeKind } from './types';

export interface StudioBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface StudioSnapGuide {
  axis: 'x' | 'y';
  position: number;
  start: number;
  end: number;
}

interface StudioAxisSnap {
  delta: number;
  position: number;
  target: StudioBounds;
}

export function nodeCenterInsideSection(
  parent: StudioNode,
  child: Pick<StudioNode, 'id' | 'x' | 'y' | 'width' | 'height'>,
) {
  if (parent.id === child.id || parent.type !== 'section') return false;
  const centerX = child.x + child.width / 2;
  const centerY = child.y + child.height / 2;
  return (
    centerX >= parent.x &&
    centerX <= parent.x + parent.width &&
    centerY >= parent.y &&
    centerY <= parent.y + parent.height
  );
}

export function containedNodeIdsForSection(
  nodes: StudioNode[],
  sectionId: string,
) {
  const section = nodes.find(
    (node) => node.id === sectionId && node.type === 'section',
  );
  if (!section) return [];
  return nodes
    .filter(
      (node) =>
        node.type !== 'section' && nodeCenterInsideSection(section, node),
    )
    .map((node) => node.id);
}

function axisPoints(bounds: StudioBounds, axis: 'x' | 'y') {
  return axis === 'x'
    ? [bounds.left, bounds.left + bounds.width / 2, bounds.right]
    : [bounds.top, bounds.top + bounds.height / 2, bounds.bottom];
}

function closestAxisSnap(
  moving: StudioBounds,
  targets: StudioBounds[],
  axis: 'x' | 'y',
  threshold: number,
): StudioAxisSnap | null {
  const movingPoints = axisPoints(moving, axis);
  let best: StudioAxisSnap | null = null;

  for (const target of targets) {
    for (const targetPoint of axisPoints(target, axis)) {
      for (const movingPoint of movingPoints) {
        const delta = targetPoint - movingPoint;
        if (Math.abs(delta) > threshold) continue;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) {
          best = { delta, position: targetPoint, target };
        }
      }
    }
  }

  return best;
}

export function resolveStudioSnap(
  moving: StudioBounds,
  targets: StudioBounds[],
  threshold: number,
) {
  const x = closestAxisSnap(moving, targets, 'x', threshold);
  const y = closestAxisSnap(moving, targets, 'y', threshold);
  const deltaX = x?.delta ?? 0;
  const deltaY = y?.delta ?? 0;
  const snapped = {
    ...moving,
    left: moving.left + deltaX,
    right: moving.right + deltaX,
    top: moving.top + deltaY,
    bottom: moving.bottom + deltaY,
  };
  const padding = Math.max(8, threshold * 1.5);
  const guides: StudioSnapGuide[] = [];

  if (x) {
    guides.push({
      axis: 'x',
      position: x.position,
      start: Math.min(snapped.top, x.target.top) - padding,
      end: Math.max(snapped.bottom, x.target.bottom) + padding,
    });
  }
  if (y) {
    guides.push({
      axis: 'y',
      position: y.position,
      start: Math.min(snapped.left, y.target.left) - padding,
      end: Math.max(snapped.right, y.target.right) + padding,
    });
  }

  return { deltaX, deltaY, guides };
}

export function parseAspect(aspect: string): [number, number] {
  if (!aspect || aspect === 'auto' || aspect === 'adaptive') return [1, 1];
  const [w, h] = aspect.split(':').map(Number);
  if (!w || !h) return [1, 1];
  return [w, h];
}

export function sizeForAspect(aspect: string, kind: StudioNodeKind = 'image') {
  if (kind === 'text') return { width: 280, height: 176 };
  if (kind === 'section') return { width: 480, height: 320 };
  const [rw, rh] = parseAspect(aspect);
  const long = 300;
  if (rw >= rh) return { width: long, height: Math.max(120, Math.round((long * rh) / rw)) };
  return { width: Math.max(120, Math.round((long * rw) / rh)), height: long };
}

export function resolutionLabel(aspect: string) {
  const [w, h] = parseAspect(aspect);
  if (w === h) return '1k';
  return `${w}:${h}`;
}

export function isGeneratorNode(data: StudioNodeData) {
  if (data.status === 'generating') return false;
  if (data.kind === 'text') return !data.text;
  return !data.src;
}
