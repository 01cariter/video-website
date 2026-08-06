// Shared visual helpers (client-safe, no server-only imports).
// Imagery is self-hosted in the `media` table. Solid colors fill clips without
// posters so the feed remains useful without external image dependencies.

import type { VideoCategory } from '@/lib/types';

const placeholderColors: Record<VideoCategory, readonly string[]> = {
  study: [
    '#3f6972',
    '#4f6e59',
    '#4b6080',
    '#625870',
    '#526d5e',
    '#59684f',
    '#48676d',
    '#5e5b76',
  ],
  play: [
    '#aa513e',
    '#995746',
    '#8f5060',
    '#92703c',
    '#426c59',
    '#49667f',
    '#56616d',
    '#5d6b50',
  ],
};

export function placeholderColor(kind: VideoCategory, i: number) {
  const set = placeholderColors[kind];
  return set[i % set.length];
}

export function hasPoster(posterUrl: string | null) {
  return Boolean(
    posterUrl &&
    !(
      posterUrl.startsWith('data:image/svg+xml') &&
      posterUrl.includes('%3Ccircle') &&
      posterUrl.includes('%3Cpath')
    ),
  );
}

// CSS background built from a self-hosted poster URL (data: URI or /api/media),
// with the solid placeholder color underneath as a fallback.
export function bg(posterUrl: string | null, kind: VideoCategory, i: number) {
  const color = placeholderColor(kind, i);
  if (hasPoster(posterUrl)) return `${color} url("${posterUrl}") center / cover no-repeat`;
  return color;
}

export function fmtLikes(n: number) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

export function initials(name: string | null | undefined) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

// Handles are stored as '@name'; profile URLs carry the bare name.
export function profileHref(handle: string | null | undefined) {
  if (!handle) return null;
  const bare = handle.replace(/^@+/, '');
  return bare ? `/u/${encodeURIComponent(bare)}` : null;
}
