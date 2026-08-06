import 'server-only';

import { sql } from './db';
import { createClient as createSupabaseClient } from './supabase/server';
import type { Media, MediaKind } from './types';

export const MEDIA_BUCKET = 'media';
export const MAX_MEDIA_UPLOAD_BYTES = 4 * 1024 * 1024;
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

interface CreateMediaInput {
  url: string;
  kind?: MediaKind;
  mime?: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  ownerId?: string | null;
}

export function kindFromMime(mime = ''): MediaKind {
  return mime.startsWith('video/') ? 'video' : 'image';
}

export async function createMediaFromUrl({
  url,
  kind,
  mime = 'image/svg+xml',
  width = null,
  height = null,
  durationSeconds = null,
  ownerId = null,
}: CreateMediaInput): Promise<Media> {
  const [row] = await sql<Media[]>`
    INSERT INTO media (kind, mime, url, width, height, duration_seconds, owner_id)
    VALUES (
      ${kind || kindFromMime(mime)}, ${mime}, ${url},
      ${width}, ${height}, ${durationSeconds}, ${ownerId}
    )
    RETURNING id, kind, mime, url, width, height, duration_seconds, created_at
  `;
  if (!row) throw new Error('Media insert returned no row.');
  return row;
}

export async function uploadMediaFile({
  file,
  mime,
  width = null,
  height = null,
  durationSeconds = null,
  ownerId,
}: {
  file: File;
  mime: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  ownerId: string;
}): Promise<Media> {
  if (!ALLOWED_MEDIA_MIME_TYPES.has(mime)) {
    throw new Error('Unsupported media type.');
  }
  if (file.size <= 0 || file.size > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error('File size must be between 1 byte and 4 MB.');
  }

  const extension = extensionFor(file.name, mime);
  const objectPath = `${ownerId}/${crypto.randomUUID()}${extension}`;
  const supabase = await createSupabaseClient();
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(objectPath, new Uint8Array(await file.arrayBuffer()), {
      contentType: mime,
      cacheControl: '31536000',
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
  try {
    return await createMediaFromUrl({
      url: data.publicUrl,
      kind: kindFromMime(mime),
      mime,
      width,
      height,
      durationSeconds,
      ownerId,
    });
  } catch (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([objectPath]);
    throw error;
  }
}

export async function getMedia(id: number): Promise<Media | null> {
  const [row] = await sql<Media[]>`
    SELECT id, kind, mime, url, data, width, height, duration_seconds
    FROM media WHERE id = ${id}
  `;
  return row ?? null;
}

export async function listMedia({
  ownerId = null,
  limit = 60,
}: { ownerId?: string | null; limit?: number } = {}): Promise<Media[]> {
  if (ownerId) {
    return sql<Media[]>`
      SELECT id, kind, mime, url, width, height, duration_seconds, created_at
      FROM media WHERE owner_id = ${ownerId}
      ORDER BY id DESC LIMIT ${limit}
    `;
  }
  return sql<Media[]>`
    SELECT id, kind, mime, url, width, height, duration_seconds, created_at
    FROM media ORDER BY id DESC LIMIT ${limit}
  `;
}

function extensionFor(fileName: string, mime: string) {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName);
  if (match) return `.${match[1].toLowerCase()}`;
  const fallback: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };
  return fallback[mime] || '';
}
