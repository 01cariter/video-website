import type { StudioNode } from '@/lib/studio/types';
import type { StudioFloatingRect } from './useLeaferStudioRuntime';

export interface StudioCanvasReferenceOption {
  id: string;
  title: string;
  src: string;
}

export function selectionIntersectsViewport(
  rect: StudioFloatingRect | null,
  viewport: {
    width: number;
    height: number;
    leftInset?: number;
    rightInset?: number;
    topInset?: number;
    bottomInset?: number;
  },
) {
  if (!rect || viewport.width <= 0 || viewport.height <= 0) return false;
  const left = Math.max(0, viewport.leftInset ?? 0);
  const right = Math.max(left, viewport.width - (viewport.rightInset ?? 0));
  const top = Math.max(0, viewport.topInset ?? 0);
  const bottom = Math.max(top, viewport.height - (viewport.bottomInset ?? 0));
  return (
    rect.right > left &&
    rect.left < right &&
    rect.bottom > top &&
    rect.top < bottom
  );
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export interface StudioChromePlacement {
  left: number;
  top: number;
  visible: boolean;
}

// Where the floating selection toolbar sits, in stage pixels. `surface` is the
// toolbar's own measured box: get it wrong and the toolbar lands nowhere near
// the node, so it is an input rather than a guess baked in here.
export function selectionChromePlacement({
  rect,
  stage,
  surface,
  leftInset = 0,
  rightInset = 0,
  below = false,
  padding = 10,
}: {
  rect: StudioFloatingRect | null;
  stage: { width: number; height: number };
  surface: { width: number; height: number };
  leftInset?: number;
  rightInset?: number;
  below?: boolean;
  padding?: number;
}): StudioChromePlacement {
  const hidden = { left: 0, top: 0, visible: false };
  if (!rect || stage.width <= 0 || stage.height <= 0) return hidden;
  if (
    !selectionIntersectsViewport(rect, {
      width: stage.width,
      height: stage.height,
      leftInset,
      rightInset,
    })
  ) {
    return hidden;
  }

  const minLeft = Math.max(padding, leftInset + padding);
  const maxLeft = Math.max(
    minLeft,
    stage.width - rightInset - surface.width - padding,
  );
  const preferredTop = below
    ? rect.bottom + padding
    : rect.top - surface.height - padding;
  return {
    left: clamp(
      rect.left + rect.width / 2 - surface.width / 2,
      minLeft,
      maxLeft,
    ),
    top: clamp(
      preferredTop,
      padding,
      Math.max(padding, stage.height - surface.height - padding),
    ),
    visible: true,
  };
}

export function canvasReferenceOptions(
  nodes: StudioNode[],
  excludedIds: string[] = [],
): StudioCanvasReferenceOption[] {
  const excluded = new Set(excludedIds);
  const seenSources = new Set<string>();
  const options: StudioCanvasReferenceOption[] = [];

  for (const node of nodes) {
    const src = typeof node.data.src === 'string' ? node.data.src.trim() : '';
    if (
      node.type !== 'image' ||
      node.data.hidden === true ||
      excluded.has(node.id) ||
      !src ||
      seenSources.has(src)
    ) {
      continue;
    }
    seenSources.add(src);
    options.push({
      id: node.id,
      title: node.data.title.trim() || 'Untitled image',
      src,
    });
  }

  return options;
}
