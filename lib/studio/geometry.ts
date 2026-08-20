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

export type StudioArrangeAction =
  | 'tidy'
  | 'align-left'
  | 'align-center-horizontal'
  | 'align-right'
  | 'align-top'
  | 'align-center-vertical'
  | 'align-bottom'
  | 'distribute-horizontal'
  | 'distribute-vertical';

interface StudioAxisSnap {
  delta: number;
  position: number;
  target: StudioBounds;
}

export function resolveStudioResizeDirection(...candidates: unknown[]) {
  for (const candidate of candidates) {
    const direction = Number(candidate);
    if (Number.isInteger(direction) && direction >= 0 && direction <= 7) {
      return direction;
    }
  }
  return null;
}

export function arrangeStudioNodes(
  nodes: StudioNode[],
  ids: string[],
  action: StudioArrangeAction,
) {
  const selected = new Set(ids);
  const items = nodes.filter(
    (node) =>
      selected.has(node.id) &&
      node.type !== 'section' &&
      node.data.hidden !== true &&
      node.data.locked !== true,
  );
  if (items.length < 2) return nodes;

  const left = Math.min(...items.map((node) => node.x));
  const top = Math.min(...items.map((node) => node.y));
  const right = Math.max(...items.map((node) => node.x + node.width));
  const bottom = Math.max(...items.map((node) => node.y + node.height));
  const patches = new Map<string, { x?: number; y?: number }>();

  if (action === 'tidy') {
    const ordered = [...items].sort((a, b) => {
      const centerGap = Math.abs(
        a.y + a.height / 2 - (b.y + b.height / 2),
      );
      const sameVisualRow = centerGap <= Math.min(a.height, b.height) / 2;
      return sameVisualRow
        ? a.x - b.x || a.y - b.y || a.zIndex - b.zIndex
        : a.y - b.y || a.x - b.x || a.zIndex - b.zIndex;
    });
    const columns =
      ordered.length <= 3 ? ordered.length : Math.ceil(Math.sqrt(ordered.length));
    const rows = Math.ceil(ordered.length / columns);
    const columnWidths = Array.from({ length: columns }, () => 0);
    const rowHeights = Array.from({ length: rows }, () => 0);
    const gap = 24;

    ordered.forEach((node, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      columnWidths[column] = Math.max(columnWidths[column], node.width);
      rowHeights[row] = Math.max(rowHeights[row], node.height);
    });

    const columnStarts = columnWidths.map(
      (_, index) =>
        left +
        columnWidths
          .slice(0, index)
          .reduce((total, width) => total + width + gap, 0),
    );
    const rowStarts = rowHeights.map(
      (_, index) =>
        top +
        rowHeights
          .slice(0, index)
          .reduce((total, height) => total + height + gap, 0),
    );

    ordered.forEach((node, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      patches.set(node.id, {
        x: columnStarts[column] + (columnWidths[column] - node.width) / 2,
        y: rowStarts[row] + (rowHeights[row] - node.height) / 2,
      });
    });
  } else if (action === 'align-left') {
    items.forEach((node) => patches.set(node.id, { x: left }));
  } else if (action === 'align-center-horizontal') {
    items.forEach((node) =>
      patches.set(node.id, { x: left + (right - left - node.width) / 2 }),
    );
  } else if (action === 'align-right') {
    items.forEach((node) =>
      patches.set(node.id, { x: right - node.width }),
    );
  } else if (action === 'align-top') {
    items.forEach((node) => patches.set(node.id, { y: top }));
  } else if (action === 'align-center-vertical') {
    items.forEach((node) =>
      patches.set(node.id, { y: top + (bottom - top - node.height) / 2 }),
    );
  } else if (action === 'align-bottom') {
    items.forEach((node) =>
      patches.set(node.id, { y: bottom - node.height }),
    );
  } else if (action === 'distribute-horizontal') {
    const ordered = [...items].sort((a, b) => a.x - b.x);
    const totalWidth = ordered.reduce((total, node) => total + node.width, 0);
    const gap = Math.max(8, (right - left - totalWidth) / (ordered.length - 1));
    let cursor = left;
    ordered.forEach((node) => {
      patches.set(node.id, { x: cursor });
      cursor += node.width + gap;
    });
  } else if (action === 'distribute-vertical') {
    const ordered = [...items].sort((a, b) => a.y - b.y);
    const totalHeight = ordered.reduce(
      (total, node) => total + node.height,
      0,
    );
    const gap = Math.max(
      8,
      (bottom - top - totalHeight) / (ordered.length - 1),
    );
    let cursor = top;
    ordered.forEach((node) => {
      patches.set(node.id, { y: cursor });
      cursor += node.height + gap;
    });
  }

  return nodes.map((node) => {
    const patch = patches.get(node.id);
    return patch ? { ...node, ...patch } : node;
  });
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

function closestResizeSnap(
  movingPoint: number | null,
  targets: StudioBounds[],
  axis: 'x' | 'y',
  threshold: number,
) {
  if (movingPoint == null) return null;
  let best: StudioAxisSnap | null = null;
  for (const target of targets) {
    for (const targetPoint of axisPoints(target, axis)) {
      const delta = targetPoint - movingPoint;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) {
        best = { delta, position: targetPoint, target };
      }
    }
  }
  return best;
}

export function resolveStudioResizeSnap(
  moving: StudioBounds,
  targets: StudioBounds[],
  direction: number,
  threshold: number,
) {
  const movesLeft = direction === 0 || direction === 6 || direction === 7;
  const movesRight = direction === 2 || direction === 3 || direction === 4;
  const movesTop = direction === 0 || direction === 1 || direction === 2;
  const movesBottom = direction === 4 || direction === 5 || direction === 6;
  const x = closestResizeSnap(
    movesLeft ? moving.left : movesRight ? moving.right : null,
    targets,
    'x',
    threshold,
  );
  const y = closestResizeSnap(
    movesTop ? moving.top : movesBottom ? moving.bottom : null,
    targets,
    'y',
    threshold,
  );
  const bounds = { ...moving };
  if (x) {
    if (movesLeft) bounds.left += x.delta;
    if (movesRight) bounds.right += x.delta;
  }
  if (y) {
    if (movesTop) bounds.top += y.delta;
    if (movesBottom) bounds.bottom += y.delta;
  }
  bounds.width = bounds.right - bounds.left;
  bounds.height = bounds.bottom - bounds.top;

  const padding = Math.max(8, threshold * 1.5);
  const guides: StudioSnapGuide[] = [];
  if (x) {
    guides.push({
      axis: 'x',
      position: x.position,
      start: Math.min(bounds.top, x.target.top) - padding,
      end: Math.max(bounds.bottom, x.target.bottom) + padding,
    });
  }
  if (y) {
    guides.push({
      axis: 'y',
      position: y.position,
      start: Math.min(bounds.left, y.target.left) - padding,
      end: Math.max(bounds.right, y.target.right) + padding,
    });
  }

  return {
    bounds,
    deltaX: x?.delta ?? 0,
    deltaY: y?.delta ?? 0,
    snappedX: Boolean(x),
    snappedY: Boolean(y),
    guides,
  };
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

export function sizeForMediaDimensions(
  width: number | null,
  height: number | null,
  kind: 'image' | 'video',
) {
  if (!width || !height || width <= 0 || height <= 0) {
    return kind === 'video'
      ? { width: 400, height: 225 }
      : { width: 340, height: 280 };
  }
  const ratio = width / height;
  const fitScale = Math.min(420 / width, 360 / height);
  let nextWidth = width * fitScale;
  let nextHeight = height * fitScale;
  const shortSide = Math.min(nextWidth, nextHeight);
  const longSide = Math.max(nextWidth, nextHeight);
  if (shortSide < 48 && longSide * (48 / shortSide) <= 720) {
    const readableScale = 48 / shortSide;
    nextWidth *= readableScale;
    nextHeight *= readableScale;
  }
  if (ratio >= 1) {
    const roundedWidth = Math.max(1, Math.round(nextWidth));
    return {
      width: roundedWidth,
      height: Math.max(1, Math.round(roundedWidth / ratio)),
    };
  }
  const roundedHeight = Math.max(1, Math.round(nextHeight));
  return {
    width: Math.max(1, Math.round(roundedHeight * ratio)),
    height: roundedHeight,
  };
}

export function resolutionLabel(aspect: string) {
  const [w, h] = parseAspect(aspect);
  if (w === h) return '1k';
  return `${w}:${h}`;
}

export function isGeneratorNode(data: StudioNodeData) {
  if (data.status === 'generating' || data.status === 'uploading') return false;
  if (data.kind === 'text') return !data.text;
  return !data.src;
}
