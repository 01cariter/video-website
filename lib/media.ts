import 'server-only';

import { sql } from './db';
import { createClient as createSupabaseClient } from './supabase/server';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_DIRECT_UPLOAD_BYTES,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_BUCKET,
  extensionFor,
  isOwnedStoragePath,
  kindFromMime,
  storagePathFromPublicUrl,
} from './media-shared';
import type { Media, MediaKind } from './types';

export {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_DIRECT_UPLOAD_BYTES,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_BUCKET,
  kindFromMime,
};

interface CreateMediaInput {
  url: string;
  kind?: MediaKind;
  mime?: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  ownerId?: string | null;
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

// Registers an object the signed-in browser already uploaded straight to
// Supabase Storage. The bytes never pass through this server, which is how
// uploads above the 4 MB request-body ceiling reach the 50 MB bucket limit.
export async function registerStorageMedia({
  path,
  mime,
  width = null,
  height = null,
  durationSeconds = null,
  ownerId,
}: {
  path: string;
  mime: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  ownerId: string;
}): Promise<Media> {
  if (!ALLOWED_MEDIA_MIME_TYPES.has(mime)) {
    throw new Error('Unsupported media type.');
  }
  if (!isOwnedStoragePath(path, ownerId)) {
    throw new Error('That storage path does not belong to you.');
  }

  const separator = path.lastIndexOf('/');
  const folder = path.slice(0, separator);
  const name = path.slice(separator + 1);

  const supabase = await createSupabaseClient();
  const { data: entries, error: listError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(folder, { search: name, limit: 100 });
  if (listError) throw new Error(listError.message);

  const object = entries?.find((entry) => entry.name === name);
  if (!object) throw new Error('That upload was not found in storage.');

  const size = Number(object.metadata?.size ?? 0);
  if (size > MAX_DIRECT_UPLOAD_BYTES) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw new Error('Uploads are limited to 50 MB.');
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
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
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
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

export async function removeOwnedStorageMedia({
  urls,
  ownerId,
}: {
  urls: string[];
  ownerId: string;
}) {
  const paths = [
    ...new Set(
      urls
        .map(storagePathFromPublicUrl)
        .filter((path): path is string => Boolean(path))
        .filter((path) => isOwnedStoragePath(path, ownerId)),
    ),
  ];
  if (paths.length === 0) return;

  const supabase = await createSupabaseClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  if (error) throw new Error(error.message);
}
