// Media constants and helpers shared by the browser uploader and the server.
// Keep this module free of `server-only` imports.

import type { MediaKind } from './types';

export const MEDIA_BUCKET = 'media';

// `POST /api/media` proxies the bytes through the Vercel request body, so it
// stays well under the platform limit. Larger files go straight to Supabase
// Storage from the browser, where the bucket limit below applies.
export const MAX_MEDIA_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_DIRECT_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

export function kindFromMime(mime = ''): MediaKind {
  return mime.startsWith('video/') ? 'video' : 'image';
}

export function extensionFor(fileName: string, mime: string) {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName);
  if (match) return `.${match[1].toLowerCase()}`;
  return EXTENSION_BY_MIME[mime] || '';
}

// Objects live under `<auth user id>/<uuid><ext>` — the shape the storage RLS
// policy `storage_media_insert_own_folder` requires.
export function storagePathFor(ownerId: string, fileName: string, mime: string) {
  return `${ownerId}/${crypto.randomUUID()}${extensionFor(fileName, mime)}`;
}

export function isOwnedStoragePath(path: string, ownerId: string) {
  const segments = path.split('/');
  return (
    segments.length === 2 &&
    segments[0] === ownerId &&
    Boolean(segments[1]) &&
    !segments[1].includes('..')
  );
}

export function storagePathFromPublicUrl(url: string) {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}
