import 'server-only';

import { cache } from 'react';
import { revalidateTag, unstable_cache } from 'next/cache';
import { assertOwnedCollection, createCollection } from './collections';
import { sql } from './db';
import type {
  Comment,
  FeedFilter,
  FeedPage,
  SocialToggle,
  Video,
  VideoAsset,
  VideoCategory,
} from './types';
import { MAX_POST_ASSETS } from './types';

interface FeedOptions {
  filter?: FeedFilter;
  /** @deprecated Use filter: { kind: 'category', category } instead */
  category?: VideoCategory | null;
  userId?: string | null;
  cursor?: string | null;
  limit?: number;
}

interface FeedCursor {
  score: number;
  id: number;
}

interface RankedVideo extends Video {
  recommendation_score: number;
}

interface RankedFeedPage {
  videos: RankedVideo[];
  nextCursor: string | null;
}

interface ViewerStateRow extends Record<string, unknown> {
  id: number;
  liked: boolean;
  saved: boolean;
  following: boolean;
}

interface CommentInsertRow extends Record<string, unknown> {
  id: number;
  body: string;
  created_at: string;
  user_id: string;
}

interface CommentAuthorRow extends Record<string, unknown> {
  author_name: string;
  author_handle: string | null;
  author_color: string;
  author_avatar: string | null;
}

export async function getFeed({ category = null, userId = null }: FeedOptions = {}): Promise<Video[]> {
  const page = await getFeedPage({ category, userId });
  return page.videos;
}

const getCachedPublicFeedPage = unstable_cache(
  async (category: VideoCategory | null, cursor: string | null, limit: number) =>
    queryPublicFeedPage({ category, cursor, limit }),
  // Bumped with the projection: cached pages from before collections landed
  // have no collection_id, and would serve chip-less posts for a minute.
  ['ranked-video-feed-v5'],
  { revalidate: 60, tags: ['videos-feed'] },
);

function resolveFeedFilter(filter: FeedFilter | undefined, category: VideoCategory | null): FeedFilter {
  if (filter) return filter;
  if (category) return { kind: 'category', category };
  return { kind: 'foryou' };
}

export async function getFeedPage({
  filter,
  category = null,
  userId = null,
  cursor = null,
  limit = 12,
}: FeedOptions = {}): Promise<FeedPage> {
  const pageSize = Math.min(Math.max(Math.trunc(limit), 1), 24);
  const resolvedFilter = resolveFeedFilter(filter, category);

  if (resolvedFilter.kind === 'following') {
    if (!userId) {
      return { videos: [], nextCursor: null };
    }
    const page = await queryFollowingFeedPage({ userId, cursor, limit: pageSize });
    const videos = await applyViewerState(page.videos, userId);
    const withMedia = await attachVideoAssets(videos.map(toPublicVideo));
    return {
      videos: withMedia,
      nextCursor: page.nextCursor,
    };
  }

  const categoryFilter = resolvedFilter.kind === 'category' ? resolvedFilter.category : null;
  const page = await getCachedPublicFeedPage(categoryFilter, cursor, pageSize);
  const videos = userId ? await applyViewerState(page.videos, userId) : page.videos;
  const withMedia = await attachVideoAssets(videos.map(toPublicVideo));
  return {
    videos: withMedia,
    nextCursor: page.nextCursor,
  };
}

function toPublicVideo(video: RankedVideo): Video {
  const result = { ...video } as Partial<RankedVideo>;
  delete result.recommendation_score;
  return result as Video;
}

interface AssetRow extends Record<string, unknown> {
  video_id: number;
  media_id: number;
  kind: 'image' | 'video';
  mime: string;
  url: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  position: number;
}

/** Attach ordered assets; fall back to legacy poster/video columns when empty. */
export async function attachVideoAssets<T extends Video>(videos: T[]): Promise<T[]> {
  if (videos.length === 0) return videos;
  const ids = videos.map((video) => video.id);
  const rows = await sql<AssetRow[]>`
    SELECT
      va.video_id, va.media_id, va.position,
      m.kind, m.mime, m.url, m.width, m.height, m.duration_seconds
    FROM video_assets va
    JOIN media m ON m.id = va.media_id
    WHERE va.video_id = ANY(${ids}::integer[])
    ORDER BY va.video_id, va.position
  `;
  const byVideo = new Map<number, VideoAsset[]>();
  for (const row of rows) {
    const list = byVideo.get(row.video_id) ?? [];
    list.push({
      media_id: row.media_id,
      kind: row.kind,
      mime: row.mime,
      url: row.url,
      width: row.width,
      height: row.height,
      duration_seconds: row.duration_seconds,
      position: row.position,
    });
    byVideo.set(row.video_id, list);
  }

  return videos.map((video) => {
    const fromTable = byVideo.get(video.id);
    const assets =
      fromTable && fromTable.length > 0 ? fromTable : legacyAssets(video);
    return { ...video, created_at: isoTimestamp(video.created_at), assets };
  });
}

/**
 * Postgres hands back `timestamptz` as a Date. Client-fetched rows are laundered
 * into ISO strings by JSON, but a server-rendered row is not: `<time dateTime>`
 * then received a Date whose server and client `toString()` disagree, so the
 * page hydrated with a mismatch and an invalid datetime attribute.
 */
function isoTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function legacyAssets(video: Video): VideoAsset[] {
  // Prefer the playable clip; poster covers are not carousel items.
  if (video.video_url) {
    return [{
      media_id: 0,
      kind: 'video',
      mime: video.video_mime || 'video/mp4',
      url: video.video_url,
      width: video.video_w,
      height: video.video_h,
      duration_seconds: null,
      position: 0,
    }];
  }
  if (video.poster_url) {
    return [{
      media_id: 0,
      kind: 'image',
      mime: 'image/jpeg',
      url: video.poster_url,
      width: video.poster_w,
      height: video.poster_h,
      duration_seconds: null,
      position: 0,
    }];
  }
  return [];
}

// Shared column list + recency-weighted score for both ranked feed queries
// below. Passed as a `${}` fragment rather than duplicated, so the two
// queries can't drift out of sync on their columns or scoring formula.
function rankedVideoSelect() {
  return sql`
    v.id, v.title, v.description, v.category, v.label, v.size, v.duration, v.created_at,
    v.likes_count, v.saves_count, v.comments_count, v.views_count, v.author_id,
    p.handle AS author_handle,
    COALESCE(p.display_name, 'Creator') AS author_name,
    p.avatar_color AS author_color,
    am.url AS author_avatar,
    p.bio AS author_bio,
    p.followers_count AS author_followers,
    v.collection_id,
    c.title AS collection_title,
    pm.url AS poster_url, pm.width AS poster_w, pm.height AS poster_h,
    vm.url AS video_url, vm.mime AS video_mime, vm.width AS video_w, vm.height AS video_h,
    false AS liked,
    false AS saved,
    false AS following,
    -- Recency is a day count, not a decay against now(), so a row's score
    -- never moves and the (score, id) cursor below stays stable mid-page.
    -- 12 a day sits just under one like (LN(2) * 18 = 12.5): fresh wins
    -- ties, engagement still wins, and neither buries the other.
    ROUND((
      LN(1 + v.likes_count) * 18
      + LN(1 + v.saves_count) * 16
      + LN(1 + v.comments_count) * 14
      + LN(1 + v.views_count) * 7
      + EXTRACT(EPOCH FROM v.created_at) / 86400 * 12
    ) * 1000)::double precision AS recommendation_score
  `;
}

async function queryPublicFeedPage({
  category,
  cursor,
  limit,
}: {
  category: VideoCategory | null;
  cursor: string | null;
  limit: number;
}): Promise<RankedFeedPage> {
  const decodedCursor = decodeFeedCursor(cursor);
  const rows = await sql<RankedVideo[]>`
    WITH ranked AS (
      SELECT
        ${rankedVideoSelect()}
      FROM videos v
      JOIN profiles p ON p.user_id = v.author_id
      LEFT JOIN media pm ON pm.id = v.poster_media_id
      LEFT JOIN media vm ON vm.id = v.video_media_id
      LEFT JOIN media am ON am.id = p.avatar_media_id
      LEFT JOIN collections c ON c.id = v.collection_id
      WHERE ${category}::text IS NULL OR v.category = ${category}::text
    )
    SELECT *
    FROM ranked
    WHERE
      ${decodedCursor?.score ?? null}::double precision IS NULL
      OR (recommendation_score, id) < (
        ${decodedCursor?.score ?? null}::double precision,
        ${decodedCursor?.id ?? null}::integer
      )
    ORDER BY recommendation_score DESC, id DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const videos = hasMore ? rows.slice(0, limit) : rows;
  const last = videos.at(-1);
  return {
    videos,
    nextCursor: hasMore && last
      ? encodeFeedCursor({ score: Number(last.recommendation_score), id: last.id })
      : null,
  };
}

async function queryFollowingFeedPage({
  userId,
  cursor,
  limit,
}: {
  userId: string;
  cursor: string | null;
  limit: number;
}): Promise<RankedFeedPage> {
  const decodedCursor = decodeFeedCursor(cursor);
  const rows = await sql<RankedVideo[]>`
    WITH ranked AS (
      SELECT
        ${rankedVideoSelect()}
      FROM videos v
      JOIN profiles p ON p.user_id = v.author_id
      LEFT JOIN media pm ON pm.id = v.poster_media_id
      LEFT JOIN media vm ON vm.id = v.video_media_id
      LEFT JOIN media am ON am.id = p.avatar_media_id
      LEFT JOIN collections c ON c.id = v.collection_id
      WHERE EXISTS (
        SELECT 1 FROM follows f
        WHERE f.author_id = v.author_id AND f.follower_id = ${userId}
      )
    )
    SELECT *
    FROM ranked
    WHERE
      ${decodedCursor?.score ?? null}::double precision IS NULL
      OR (recommendation_score, id) < (
        ${decodedCursor?.score ?? null}::double precision,
        ${decodedCursor?.id ?? null}::integer
      )
    ORDER BY recommendation_score DESC, id DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const videos = hasMore ? rows.slice(0, limit) : rows;
  const last = videos.at(-1);
  return {
    videos,
    nextCursor: hasMore && last
      ? encodeFeedCursor({ score: Number(last.recommendation_score), id: last.id })
      : null,
  };
}

async function applyViewerState(videos: RankedVideo[], userId: string): Promise<RankedVideo[]> {
  if (videos.length === 0) return videos;
  const ids = videos.map((video) => video.id);
  const states = await sql<ViewerStateRow[]>`
    SELECT
      v.id,
      EXISTS (
        SELECT 1 FROM video_likes vl
        WHERE vl.video_id = v.id AND vl.user_id = ${userId}
      ) AS liked,
      EXISTS (
        SELECT 1 FROM video_saves vs
        WHERE vs.video_id = v.id AND vs.user_id = ${userId}
      ) AS saved,
      EXISTS (
        SELECT 1 FROM follows f
        WHERE f.author_id = v.author_id AND f.follower_id = ${userId}
      ) AS following
    FROM videos v
    WHERE v.id = ANY(${ids}::integer[])
  `;
  const byId = new Map(states.map((state) => [state.id, state]));
  return videos.map((video) => ({ ...video, ...byId.get(video.id) }));
}

function encodeFeedCursor(cursor: FeedCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeFeedCursor(cursor: string | null): FeedCursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<FeedCursor>;
    if (!Number.isFinite(value.score) || !Number.isInteger(value.id)) return null;
    return { score: Number(value.score), id: Number(value.id) };
  } catch {
    return null;
  }
}

export const getVideoById = cache(async function getVideoById({
  id,
  userId = null,
}: {
  id: number;
  userId?: string | null;
}) {
  const [row] = await sql<Video[]>`
    SELECT
      v.id, v.title, v.description, v.category, v.label, v.size, v.duration, v.created_at,
      v.likes_count, v.saves_count, v.comments_count, v.views_count, v.author_id,
      p.handle AS author_handle,
      COALESCE(p.display_name, 'Creator') AS author_name,
      p.avatar_color AS author_color,
      am.url AS author_avatar,
      p.bio AS author_bio,
      p.followers_count AS author_followers,
      v.collection_id,
      c.title AS collection_title,
      pm.url AS poster_url, pm.width AS poster_w, pm.height AS poster_h,
      vm.url AS video_url, vm.mime AS video_mime, vm.width AS video_w, vm.height AS video_h,
      CASE WHEN ${userId}::text IS NULL THEN false ELSE EXISTS (
        SELECT 1 FROM video_likes vl WHERE vl.video_id = v.id AND vl.user_id = ${userId}::text
      ) END AS liked,
      CASE WHEN ${userId}::text IS NULL THEN false ELSE EXISTS (
        SELECT 1 FROM video_saves vs WHERE vs.video_id = v.id AND vs.user_id = ${userId}::text
      ) END AS saved,
      CASE WHEN ${userId}::text IS NULL THEN false ELSE EXISTS (
        SELECT 1 FROM follows f WHERE f.author_id = v.author_id AND f.follower_id = ${userId}::text
      ) END AS following
    FROM videos v
    JOIN profiles p ON p.user_id = v.author_id
    LEFT JOIN media pm ON pm.id = v.poster_media_id
    LEFT JOIN media vm ON vm.id = v.video_media_id
    LEFT JOIN media am ON am.id = p.avatar_media_id
    LEFT JOIN collections c ON c.id = v.collection_id
    WHERE v.id = ${id}
  `;
  if (!row) return null;
  const [withMedia] = await attachVideoAssets([{ ...row, assets: [] }]);
  return withMedia ?? null;
});

export interface CreateVideoInput {
  userId: string;
  title?: string | null;
  description: string;
  category: VideoCategory;
  label?: string | null;
  /** Ordered carousel media (0–20). Cover posters for videos are not included. */
  mediaIds?: number[];
  /** Legacy single-slot fields; used only when mediaIds is omitted. */
  posterMediaId?: number | null;
  videoMediaId?: number | null;
  duration?: string;
  /** An existing collection of the author's, or null for a standalone post. */
  collectionId?: number | null;
  /** Creates a collection and posts into it in one step. */
  newCollectionTitle?: string | null;
}

export async function createVideo({
  userId,
  title = null,
  description,
  category,
  label = null,
  mediaIds: rawMediaIds,
  posterMediaId = null,
  videoMediaId = null,
  duration = '',
  collectionId = null,
  newCollectionTitle = null,
}: CreateVideoInput): Promise<Video> {
  const body = description.trim();
  if (!body) {
    throw new Error('Write something before posting.');
  }

  let mediaIds = (rawMediaIds ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, MAX_POST_ASSETS);

  // Deduplicate while preserving order.
  mediaIds = [...new Set(mediaIds)];

  if (mediaIds.length === 0 && (posterMediaId || videoMediaId)) {
    mediaIds = [videoMediaId, posterMediaId].filter(
      (id): id is number => Number.isInteger(id) && id !== null && id > 0,
    );
    // Prefer video-only when both were sent as legacy cover+clip.
    if (videoMediaId && posterMediaId) {
      mediaIds = [videoMediaId];
    }
  }

  if (mediaIds.length > 0) {
    // The direct Postgres connection bypasses RLS, so re-check ownership.
    const owned = await sql<Array<{ id: number; kind: string }>>`
      SELECT id, kind FROM media
      WHERE id = ANY(${mediaIds}::integer[]) AND owner_id = ${userId}
    `;
    if (owned.length !== mediaIds.length) {
      throw new Error('That media does not belong to you.');
    }
    const kindById = new Map(owned.map((row) => [row.id, row.kind]));
    const firstImage = mediaIds.find((id) => kindById.get(id) === 'image') ?? null;
    const firstVideo = mediaIds.find((id) => kindById.get(id) === 'video') ?? null;
    posterMediaId = firstImage ?? posterMediaId;
    videoMediaId = firstVideo ?? videoMediaId;
  } else {
    posterMediaId = null;
    videoMediaId = null;
  }

  const collection = newCollectionTitle?.trim()
    ? (await createCollection({ userId, title: newCollectionTitle })).id
    : collectionId
      ? await assertOwnedCollection(collectionId, userId)
      : null;

  const [row] = await sql<Array<{ id: number }>>`
    INSERT INTO videos
      (title, description, category, label, author_id, poster_media_id, video_media_id,
       duration, collection_id)
    VALUES (
      ${title?.trim() || null}, ${body}, ${category}, ${label},
      ${userId}, ${posterMediaId}, ${videoMediaId}, ${duration}, ${collection}
    )
    RETURNING id
  `;
  if (!row) throw new Error('The post could not be created.');

  if (mediaIds.length > 0) {
    for (let position = 0; position < mediaIds.length; position += 1) {
      await sql`
        INSERT INTO video_assets (video_id, media_id, position)
        VALUES (${row.id}, ${mediaIds[position]}, ${position})
      `;
    }
  }

  revalidateTag('videos-feed', 'max');
  const video = await getVideoById({ id: row.id, userId });
  if (!video) throw new Error('The post could not be loaded after creation.');
  return video;
}

interface DeletedMediaRow extends Record<string, unknown> {
  id: number;
  url: string | null;
}

export async function deleteVideo({
  userId,
  videoId,
}: {
  userId: string;
  videoId: number;
}): Promise<{ storageUrls: string[] } | null> {
  const media = await sql<DeletedMediaRow[]>`
    SELECT DISTINCT m.id, m.url
    FROM videos v
    JOIN media m ON (
      m.id = v.poster_media_id
      OR m.id = v.video_media_id
      OR EXISTS (
        SELECT 1 FROM video_assets va
        WHERE va.video_id = v.id AND va.media_id = m.id
      )
    )
    WHERE v.id = ${videoId}
      AND v.author_id = ${userId}
      AND m.owner_id = ${userId}
  `;

  const [deleted] = await sql<Array<{ id: number }>>`
    DELETE FROM videos
    WHERE id = ${videoId} AND author_id = ${userId}
    RETURNING id
  `;
  if (!deleted) return null;

  const mediaIds = media.map((item) => item.id);
  const removedMedia =
    mediaIds.length > 0
      ? await sql<DeletedMediaRow[]>`
          DELETE FROM media m
          WHERE m.id = ANY(${mediaIds}::integer[])
            AND m.owner_id = ${userId}
            AND NOT EXISTS (
              SELECT 1 FROM video_assets va WHERE va.media_id = m.id
            )
            AND NOT EXISTS (
              SELECT 1 FROM videos remaining
              WHERE remaining.poster_media_id = m.id OR remaining.video_media_id = m.id
            )
          RETURNING m.id, m.url
        `
      : [];

  revalidateTag('videos-feed', 'max');
  return {
    storageUrls: removedMedia
      .map((item) => item.url)
      .filter((url): url is string => Boolean(url)),
  };
}

// `views_count` was displayed and fed the ranking but nothing ever incremented
// it, so every post read 0 views forever. One view is one open of the player.
// The direct connection owns the table, so this needs no migration and no
// counter function — unlike likes, a view has no row of its own to protect.
// The public feed refreshes every 60 seconds; invalidating it for every view
// turns a hot write endpoint into a global cache miss storm.
export async function recordVideoView(videoId: number): Promise<number> {
  const [row] = await sql<Array<{ views_count: number }>>`
    UPDATE videos SET views_count = views_count + 1
    WHERE id = ${videoId}
    RETURNING views_count
  `;
  return row?.views_count ?? 0;
}

// Likes and saves used to go through Postgres functions (`toggle_video_like`,
// `toggle_video_save`). A database that never had the migration applied has no
// such function, so every like threw and the button silently sprang back — and
// nothing in the app could repair that from the outside. The toggle is plain
// SQL now: delete-or-insert, then set the counter to what the rows actually
// say. That needs no migration, and it heals a counter that has drifted
// instead of trusting a trigger to have kept it honest.
async function toggleRow({
  table,
  column,
  userId,
  videoId,
}: {
  table: 'video_likes' | 'video_saves';
  column: 'likes_count' | 'saves_count';
  userId: string;
  videoId: number;
}): Promise<{ on: boolean; count: number }> {
  const removed = await sql.unsafe<Array<{ ok: number }>>(
    `DELETE FROM ${table} WHERE user_id = $1::text AND video_id = $2::integer RETURNING 1 AS ok`,
    [userId, videoId],
  );
  const on = removed.length === 0;
  if (on) {
    await sql.unsafe(
      `INSERT INTO ${table} (user_id, video_id) VALUES ($1::text, $2::integer)
       ON CONFLICT DO NOTHING`,
      [userId, videoId],
    );
  }

  // Counted from the rows rather than adjusted by one, so a miscount from a
  // missing trigger or an earlier failure corrects itself on the next tap.
  const [row] = await sql.unsafe<Array<{ count: number }>>(
    `UPDATE videos SET ${column} = (
       SELECT COUNT(*) FROM ${table} WHERE video_id = $1::integer
     ) WHERE id = $1::integer RETURNING ${column} AS count`,
    [videoId],
  );

  revalidateTag('videos-feed', 'max');
  return { on, count: Number(row?.count ?? 0) };
}

export async function toggleLike({ userId, videoId }: { userId: string; videoId: number }): Promise<SocialToggle> {
  const { on, count } = await toggleRow({
    table: 'video_likes',
    column: 'likes_count',
    userId,
    videoId,
  });
  return { liked: on, likes_count: count };
}

export async function toggleSave({ userId, videoId }: { userId: string; videoId: number }): Promise<SocialToggle> {
  const { on, count } = await toggleRow({
    table: 'video_saves',
    column: 'saves_count',
    userId,
    videoId,
  });
  return { saved: on, saves_count: count };
}

export async function toggleFollow({
  followerId,
  authorId,
}: { followerId: string; authorId: string }): Promise<SocialToggle> {
  if (!authorId || followerId === authorId) {
    return { following: false, followers_count: 0 };
  }
  const removed = await sql<Array<{ ok: number }>>`
    DELETE FROM follows
    WHERE follower_id = ${followerId} AND author_id = ${authorId}
    RETURNING 1 AS ok
  `;
  const following = removed.length === 0;
  if (following) {
    await sql`
      INSERT INTO follows (follower_id, author_id)
      VALUES (${followerId}, ${authorId})
      ON CONFLICT DO NOTHING
    `;
  }

  const [row] = await sql<Array<{ followers_count: number }>>`
    UPDATE profiles SET followers_count = (
      SELECT COUNT(*) FROM follows WHERE author_id = ${authorId}
    ) WHERE user_id = ${authorId}
    RETURNING followers_count
  `;

  revalidateTag('videos-feed', 'max');
  return { following, followers_count: Number(row?.followers_count ?? 0) };
}

export async function getComments(videoId: number): Promise<Comment[]> {
  return sql<Comment[]>`
    SELECT
      c.id, c.body, c.created_at, c.user_id,
      COALESCE(p.display_name, 'You') AS author_name,
      p.handle AS author_handle,
      p.avatar_color AS author_color,
      am.url AS author_avatar
    FROM comments c
    LEFT JOIN profiles p ON p.user_id = c.user_id
    LEFT JOIN media am ON am.id = p.avatar_media_id
    WHERE c.video_id = ${videoId}
    ORDER BY c.created_at DESC
    LIMIT 200
  `;
}

export async function addComment({
  userId,
  videoId,
  body,
}: { userId: string; videoId: number; body: unknown }): Promise<{
  comment: Comment;
  comments_count: number;
} | null> {
  const text = String(body || '').trim().slice(0, 1000);
  if (!text) return null;

  const [inserted] = await sql<CommentInsertRow[]>`
    INSERT INTO comments (user_id, video_id, body)
    VALUES (${userId}, ${videoId}, ${text})
    RETURNING id, body, created_at, user_id
  `;
  if (!inserted) return null;

  const [counted] = await sql<Array<{ comments_count: number }>>`
    UPDATE videos SET comments_count = (
      SELECT COUNT(*) FROM comments WHERE video_id = ${videoId}
    ) WHERE id = ${videoId}
    RETURNING comments_count
  `;
  const row = { ...inserted, comments_count: Number(counted?.comments_count ?? 0) };
  const [author] = await sql<CommentAuthorRow[]>`
    SELECT COALESCE(p.display_name, 'You') AS author_name, p.handle AS author_handle,
      p.avatar_color AS author_color, am.url AS author_avatar
    FROM profiles p
    LEFT JOIN media am ON am.id = p.avatar_media_id
    WHERE p.user_id = ${userId}
  `;
  if (!row || !author) return null;

  revalidateTag('videos-feed', 'max');
  return {
    comment: { ...row, ...author },
    comments_count: row.comments_count,
  };
}

export async function deleteComment({
  userId,
  videoId,
  commentId,
}: {
  userId: string;
  videoId: number;
  commentId: number;
}): Promise<{ comments_count: number } | null> {
  const [deleted] = await sql<Array<{ id: number }>>`
    DELETE FROM comments
    WHERE id = ${commentId}
      AND video_id = ${videoId}
      AND user_id = ${userId}
    RETURNING id
  `;
  if (!deleted) return null;

  const [counted] = await sql<Array<{ comments_count: number }>>`
    UPDATE videos SET comments_count = (
      SELECT COUNT(*) FROM comments WHERE video_id = ${videoId}
    )
    WHERE id = ${videoId}
    RETURNING comments_count
  `;

  revalidateTag('videos-feed', 'max');
  return { comments_count: Number(counted?.comments_count ?? 0) };
}
