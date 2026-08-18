import type { StudioNodeData, StudioNodeKind } from './types';

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
