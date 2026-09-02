import 'server-only';

import { revalidateTag } from 'next/cache';
import { sql } from './db';
import { VIDEO_COLUMNS, VIDEO_SOURCE } from './profiles';
import {
  MAX_COLLECTION_TITLE_LENGTH,
  type Collection,
  type CollectionEpisode,
  type CollectionSummary,
  type Video,
} from './types';
import { attachVideoAssets } from './videos';

export const MAX_COLLECTION_DESCRIPTION_LENGTH = 200;

export function normalizeCollectionTitle(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_COLLECTION_TITLE_LENGTH);
}

const OWNER_COLUMNS = `
  c.id, c.title, c.description, c.owner_id, c.created_at,
  p.handle AS owner_handle,
  COALESCE(p.display_name, 'Creator') AS owner_name,
  p.avatar_color AS owner_color,
  am.url AS owner_avatar,
  (SELECT COUNT(*) FROM videos v WHERE v.collection_id = c.id)::integer AS posts_count
`;

const OWNER_SOURCE = `
  FROM collections c
  JOIN profiles p ON p.user_id = c.owner_id
  LEFT JOIN media am ON am.id = p.avatar_media_id
`;

/** The signed-in creator's own collections, newest first, for the composer. */
export async function listOwnedCollections(userId: string) {
  return sql.unsafe<CollectionSummary[]>(
    `SELECT c.id, c.title, c.owner_id,
       (SELECT COUNT(*) FROM videos v WHERE v.collection_id = c.id)::integer AS posts_count
     FROM collections c
     WHERE c.owner_id = $1::text
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT 200`,
    [userId],
  );
}

export async function getCollection(id: number): Promise<Collection | null> {
  const [row] = await sql.unsafe<Collection[]>(
    `SELECT ${OWNER_COLUMNS} ${OWNER_SOURCE} WHERE c.id = $1::integer`,
    [id],
  );
  return row ?? null;
}

/** Every post in the collection, in publication order — episode 1 first. */
export async function getCollectionVideos({
  collectionId,
  viewerId = null,
  limit = 120,
}: {
  collectionId: number;
  viewerId?: string | null;
  limit?: number;
}): Promise<Video[]> {
  const rows = await sql.unsafe<Video[]>(
    `SELECT ${VIDEO_COLUMNS} ${VIDEO_SOURCE}
     WHERE v.collection_id = $2::integer
     ORDER BY v.collection_position ASC NULLS LAST, v.created_at ASC, v.id ASC
     LIMIT ${Math.min(Math.max(Math.trunc(limit), 1), 200)}`,
    [viewerId, collectionId],
  );
  return attachVideoAssets(
    rows.map((row) => ({ ...row, assets: row.assets ?? [] })),
  );
}

/**
 * Just enough of each episode to draw a switcher — the detail page already has
 * the post it is showing, and does not need 120 more of them in full.
 */
export async function getCollectionEpisodes(
  collectionId: number,
): Promise<CollectionEpisode[]> {
  return sql.unsafe<CollectionEpisode[]>(
    `SELECT v.id, COALESCE(NULLIF(TRIM(v.title), ''), LEFT(TRIM(v.description), 60), 'Post') AS title,
       pm.url AS poster_url, v.duration, v.created_at
     FROM videos v
     LEFT JOIN media pm ON pm.id = v.poster_media_id
     WHERE v.collection_id = $1::integer
     ORDER BY v.collection_position ASC NULLS LAST, v.created_at ASC, v.id ASC
     LIMIT 200`,
    [collectionId],
  );
}

export async function createCollection({
  userId,
  title,
  description = null,
}: {
  userId: string;
  title: string;
  description?: string | null;
}): Promise<CollectionSummary> {
  const name = normalizeCollectionTitle(title);
  if (!name) throw new Error('Give the collection a name.');

  const [row] = await sql<CollectionSummary[]>`
    INSERT INTO collections (owner_id, title, description)
    VALUES (
      ${userId},
      ${name},
      ${description?.trim().slice(0, MAX_COLLECTION_DESCRIPTION_LENGTH) || null}
    )
    RETURNING id, title, owner_id, 0 AS posts_count
  `;
  if (!row) throw new Error('The collection could not be created.');
  return row;
}

/**
 * A post can only join a collection its own author owns. The direct Postgres
 * connection bypasses RLS, so this is the check that matters.
 */
export async function assertOwnedCollection(
  collectionId: number,
  userId: string,
) {
  const [row] = await sql<Array<{ id: number }>>`
    SELECT id FROM collections
    WHERE id = ${collectionId} AND owner_id = ${userId}
  `;
  if (!row) throw new Error('That collection does not belong to you.');
  return row.id;
}

export function revalidateCollections() {
  revalidateTag('videos-feed', 'max');
}

export async function updateCollection({
  id,
  userId,
  title,
  description,
}: {
  id: number;
  userId: string;
  title: string;
  description: string | null;
}) {
  const name = normalizeCollectionTitle(title);
  if (!name) throw new Error('Give the collection a name.');
  const [row] = await sql<CollectionSummary[]>`
    UPDATE collections
    SET title = ${name},
        description = ${description?.trim().slice(0, MAX_COLLECTION_DESCRIPTION_LENGTH) || null},
        updated_at = now()
    WHERE id = ${id} AND owner_id = ${userId}
    RETURNING id, title, owner_id,
      (SELECT COUNT(*) FROM videos v WHERE v.collection_id = collections.id)::integer AS posts_count
  `;
  if (!row) throw new Error('That collection does not belong to you.');
  revalidateCollections();
  return row;
}

/** The posts stay; only the grouping goes. */
export async function deleteCollection({
  id,
  userId,
}: {
  id: number;
  userId: string;
}) {
  const [row] = await sql<Array<{ id: number }>>`
    DELETE FROM collections WHERE id = ${id} AND owner_id = ${userId}
    RETURNING id
  `;
  if (!row) throw new Error('That collection does not belong to you.');
  revalidateCollections();
  return row.id;
}

/**
 * Writes a whole order in one go. The caller sends every episode id it is
 * showing, so a stale tab cannot silently drop the posts it never saw.
 */
export async function reorderCollection({
  id,
  userId,
  order,
}: {
  id: number;
  userId: string;
  order: number[];
}) {
  await assertOwnedCollection(id, userId);
  const ids = [...new Set(order.filter((value) => Number.isInteger(value)))];
  const current = await sql<Array<{ id: number }>>`
    SELECT id FROM videos WHERE collection_id = ${id}
  `;
  if (ids.length !== current.length) {
    throw new Error('The collection changed while you were reordering it.');
  }
  const known = new Set(current.map((row) => row.id));
  if (ids.some((value) => !known.has(value))) {
    throw new Error('That post is not in this collection.');
  }
  await sql`
    UPDATE videos SET collection_position = ordered.position
    FROM (
      SELECT * FROM UNNEST(
        ${ids}::integer[],
        ${ids.map((_, index) => index + 1)}::integer[]
      ) AS t(id, position)
    ) AS ordered
    WHERE videos.id = ordered.id AND videos.collection_id = ${id}
  `;
  revalidateCollections();
}

/**
 * Moves an already-published post into a collection, out of one, or into a
 * brand new one. Both the post and the collection have to be the caller's.
 */
export async function setVideoCollection({
  videoId,
  userId,
  collectionId,
  newCollectionTitle,
}: {
  videoId: number;
  userId: string;
  collectionId: number | null;
  newCollectionTitle?: string | null;
}) {
  const [owned] = await sql<Array<{ id: number }>>`
    SELECT id FROM videos WHERE id = ${videoId} AND author_id = ${userId}
  `;
  if (!owned) throw new Error('That post does not belong to you.');

  const target = newCollectionTitle?.trim()
    ? (await createCollection({ userId, title: newCollectionTitle })).id
    : collectionId
      ? await assertOwnedCollection(collectionId, userId)
      : null;

  // Append to the end of whichever collection it joins.
  const [next] = target
    ? await sql<Array<{ position: number }>>`
        SELECT COALESCE(MAX(collection_position), 0) + 1 AS position
        FROM videos WHERE collection_id = ${target}
      `
    : [{ position: 0 }];

  await sql`
    UPDATE videos
    SET collection_id = ${target},
        collection_position = ${target ? next.position : null}
    WHERE id = ${videoId} AND author_id = ${userId}
  `;
  revalidateCollections();
  return target;
}
