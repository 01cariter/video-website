// Shared visual helpers (client-safe, no server-only imports).
// Imagery is self-hosted in the `media` table. Solid colors fill clips without
// posters so the feed remains useful without external image dependencies.

import type { Video, VideoCategory } from '@/lib/types';

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

// A fixed locale and UTC, so the server and the browser render the same string
// and hydration does not trip over the reader's timezone.
const UPLOAD_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function fmtDate(timestamp: string | null | undefined) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : UPLOAD_DATE.format(date);
}

// X-style short relative time for timeline rows. "now" covers the whole
// first minute rather than counting seconds, so a server render and the
// client hydrating a beat later can't disagree and trip a hydration warning.
export function fmtRelativeTime(timestamp: string | null | undefined) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'now';
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return fmtDate(timestamp);
}

// The grid used to shape a card from its index, so the same post changed shape
// as the feed reordered and a portrait clip could land in a letterbox. Shape
// follows the media's own proportions instead, and only falls back to the
// index when a post has no measurements to go on.
export function cardSize(video: Video, index: number) {
  const width = video.poster_w ?? video.video_w;
  const height = video.poster_h ?? video.video_h;
  if (!width || !height) {
    const pattern = index % 8;
    return pattern === 0 ? 'big' : pattern === 1 ? 'tall' : '';
  }
  const ratio = width / height;
  if (ratio <= 0.8) return 'tall';
  if (ratio >= 1.6) return 'big';
  return '';
}

// Avatars render as a colored initial until the account uploads an image;
// painting the image as the same span's background keeps every call site a
// one-line change instead of a new element.
export function avatarStyle(color: string, url?: string | null) {
  if (!url) return { background: color };
  return {
    background: `${color} url("${url}") center / cover no-repeat`,
    color: 'transparent',
  };
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
