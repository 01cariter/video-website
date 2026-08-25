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
