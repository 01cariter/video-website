import 'server-only';

import { revalidateTag, unstable_cache } from 'next/cache';
import { sql } from './db';
import type { Comment, FeedPage, SocialToggle, Video, VideoCategory } from './types';

interface FeedOptions {
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
}

export async function getFeed({ category = null, userId = null }: FeedOptions = {}): Promise<Video[]> {
  const page = await getFeedPage({ category, userId });
  return page.videos;
}

const getCachedPublicFeedPage = unstable_cache(
  async (category: VideoCategory | null, cursor: string | null, limit: number) =>
    queryPublicFeedPage({ category, cursor, limit }),
  ['ranked-video-feed-v3'],
  { revalidate: 60, tags: ['videos-feed'] },
);

export async function getFeedPage({
  category = null,
  userId = null,
  cursor = null,
  limit = 12,
}: FeedOptions = {}): Promise<FeedPage> {
  const pageSize = Math.min(Math.max(Math.trunc(limit), 1), 24);
  const page = await getCachedPublicFeedPage(category, cursor, pageSize);
  const videos = userId ? await applyViewerState(page.videos, userId) : page.videos;
  return {
    videos: videos.map(toPublicVideo),
    nextCursor: page.nextCursor,
  };
}

function toPublicVideo(video: RankedVideo): Video {
  const result = { ...video } as Partial<RankedVideo>;
  delete result.recommendation_score;
  return result as Video;
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
        v.id, v.title, v.description, v.category, v.label, v.size, v.duration,
        v.likes_count, v.saves_count, v.comments_count, v.views_count, v.author_id,
        p.handle AS author_handle,
        COALESCE(p.display_name, 'Creator') AS author_name,
        p.avatar_color AS author_color,
        p.bio AS author_bio,
        p.followers_count AS author_followers,
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
      FROM videos v
      JOIN profiles p ON p.user_id = v.author_id
      LEFT JOIN media pm ON pm.id = v.poster_media_id
      LEFT JOIN media vm ON vm.id = v.video_media_id
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

export async function getVideoById({ id, userId = null }: { id: number; userId?: string | null }) {
  const [row] = await sql<Video[]>`
    SELECT
      v.id, v.title, v.description, v.category, v.label, v.size, v.duration, v.created_at,
      v.likes_count, v.saves_count, v.comments_count, v.views_count, v.author_id,
      p.handle AS author_handle,
      COALESCE(p.display_name, 'Creator') AS author_name,
      p.avatar_color AS author_color,
      p.bio AS author_bio,
      p.followers_count AS author_followers,
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
    WHERE v.id = ${id}
  `;
  return row ?? null;
}

export interface CreateVideoInput {
  userId: string;
  title: string;
  description?: string | null;
  category: VideoCategory;
  label?: string | null;
  posterMediaId?: number | null;
  videoMediaId?: number | null;
  duration?: string;
}

export async function createVideo({
  userId,
  title,
  description = null,
  category,
  label = null,
  posterMediaId = null,
  videoMediaId = null,
  duration = '',
}: CreateVideoInput): Promise<Video> {
  const mediaIds = [posterMediaId, videoMediaId].filter(
    (id): id is number => Number.isInteger(id),
  );
  if (mediaIds.length === 0) {
    throw new Error('A post needs at least a photo or a video.');
  }

  // The direct Postgres connection bypasses RLS, so re-check the ownership the
  // `media_*_own` policies would have enforced.
  const owned = await sql<Array<{ id: number }>>`
    SELECT id FROM media
    WHERE id = ANY(${mediaIds}::integer[]) AND owner_id = ${userId}
  `;
  if (owned.length !== mediaIds.length) {
    throw new Error('That media does not belong to you.');
  }

  const [row] = await sql<Array<{ id: number }>>`
    INSERT INTO videos
      (title, description, category, label, author_id, poster_media_id, video_media_id, duration)
    VALUES (
      ${title}, ${description}, ${category}, ${label},
      ${userId}, ${posterMediaId}, ${videoMediaId}, ${duration}
    )
    RETURNING id
  `;
  if (!row) throw new Error('The post could not be created.');

  revalidateTag('videos-feed', 'max');
  const video = await getVideoById({ id: row.id, userId });
  if (!video) throw new Error('The post could not be loaded after creation.');
  return video;
}

// `views_count` was displayed and fed the ranking but nothing ever incremented
// it, so every post read 0 views forever. One view is one open of the player.
// The direct connection owns the table, so this needs no migration and no
// counter function — unlike likes, a view has no row of its own to protect.
export async function recordVideoView(videoId: number): Promise<number> {
  const [row] = await sql<Array<{ views_count: number }>>`
    UPDATE videos SET views_count = views_count + 1
    WHERE id = ${videoId}
    RETURNING views_count
  `;
  revalidateTag('videos-feed', 'max');
  return row?.views_count ?? 0;
}

export async function toggleLike({ userId, videoId }: { userId: string; videoId: number }): Promise<SocialToggle> {
  const [result] = await sql<Array<{ liked: boolean; likes_count: number }>>`
    SELECT liked, likes_count
    FROM public.toggle_video_like(${userId}, ${videoId})
  `;
  revalidateTag('videos-feed', 'max');
  return result ?? { liked: false, likes_count: 0 };
}

export async function toggleSave({ userId, videoId }: { userId: string; videoId: number }): Promise<SocialToggle> {
  const [result] = await sql<Array<{ saved: boolean; saves_count: number }>>`
    SELECT saved, saves_count
    FROM public.toggle_video_save(${userId}, ${videoId})
  `;
  revalidateTag('videos-feed', 'max');
  return result ?? { saved: false, saves_count: 0 };
}

export async function toggleFollow({
  followerId,
  authorId,
}: { followerId: string; authorId: string }): Promise<SocialToggle> {
  if (!authorId || followerId === authorId) {
    return { following: false, followers_count: 0 };
  }
  const [result] = await sql<Array<{ following: boolean; followers_count: number }>>`
    SELECT following, followers_count
    FROM public.toggle_author_follow(${followerId}, ${authorId})
  `;
  revalidateTag('videos-feed', 'max');
  return result ?? { following: false, followers_count: 0 };
}

export async function getComments(videoId: number): Promise<Comment[]> {
  return sql<Comment[]>`
    SELECT
      c.id, c.body, c.created_at, c.user_id,
      COALESCE(p.display_name, 'You') AS author_name,
      p.handle AS author_handle,
      p.avatar_color AS author_color
    FROM comments c
    LEFT JOIN profiles p ON p.user_id = c.user_id
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

  const [row] = await sql<Array<CommentInsertRow & { comments_count: number }>>`
    SELECT id, body, created_at, user_id, comments_count
    FROM public.add_video_comment(${userId}, ${videoId}, ${text})
  `;
  const [author] = await sql<CommentAuthorRow[]>`
    SELECT COALESCE(display_name, 'You') AS author_name, handle AS author_handle, avatar_color AS author_color
    FROM profiles WHERE user_id = ${userId}
  `;
  if (!row || !author) return null;

  revalidateTag('videos-feed', 'max');
  return {
    comment: { ...row, ...author },
    comments_count: row.comments_count,
  };
}
