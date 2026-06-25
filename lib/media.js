import 'server-only';
import { sql } from './db';

// ============================================================================
// Self-hosted media store. Everything lives in our own `media` table — either
// as a URL / `data:` URI (`url`) or inline bytes (`data` BYTEA). No external CDN.
// ============================================================================

export function kindFromMime(mime = '') {
  return String(mime).startsWith('video/') ? 'video' : 'image';
}

// Insert a media row from an already-resolved URL (external, self, or data: URI).
export async function createMediaFromUrl({
  url,
  kind,
  mime = 'image/svg+xml',
  width = null,
  height = null,
  durationSeconds = null,
  ownerId = null,
}) {
  const [row] = await sql`
    INSERT INTO media (kind, mime, url, width, height, duration_seconds, owner_id)
    VALUES (
      ${kind || kindFromMime(mime)}, ${mime}, ${url},
      ${width}, ${height}, ${durationSeconds}, ${ownerId}
    )
    RETURNING id, kind, mime, url, width, height, duration_seconds, created_at
  `;
  return row;
}

// Insert a media row from raw bytes (stored inline as a base64 `data:` URI so
// it is fully contained in the database and trivially served back).
export async function createMediaFromBytes({
  bytes,
  mime,
  width = null,
  height = null,
  durationSeconds = null,
  ownerId = null,
}) {
  const base64 = Buffer.from(bytes).toString('base64');
  const url = `data:${mime};base64,${base64}`;
  return createMediaFromUrl({ url, kind: kindFromMime(mime), mime, width, height, durationSeconds, ownerId });
}

export async function getMedia(id) {
  const [row] = await sql`
    SELECT id, kind, mime, url, data, width, height, duration_seconds
    FROM media WHERE id = ${id}
  `;
  return row ?? null;
}

export async function listMedia({ ownerId = null, limit = 60 } = {}) {
  if (ownerId) {
    return sql`
      SELECT id, kind, mime, url, width, height, duration_seconds, created_at
      FROM media WHERE owner_id = ${ownerId}
      ORDER BY id DESC LIMIT ${limit}
    `;
  }
  return sql`
    SELECT id, kind, mime, url, width, height, duration_seconds, created_at
    FROM media ORDER BY id DESC LIMIT ${limit}
  `;
}
