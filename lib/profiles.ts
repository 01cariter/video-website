import 'server-only';

import { sql } from './db';
import { levelFromXp } from './levels';
import type { Profile, Video } from './types';

// The feed projection, reused by every profile listing. `$1` is the viewer id
// (nullable) and `$2` is the profile the rows are being read for.
const VIDEO_COLUMNS = `
  v.id, v.title, v.description, v.category, v.label, v.size, v.duration, v.created_at,
  v.likes_count, v.saves_count, v.comments_count, v.views_count, v.author_id,
  p.handle AS author_handle,
  COALESCE(p.display_name, 'Creator') AS author_name,
  p.avatar_color AS author_color,
  p.bio AS author_bio,
  p.followers_count AS author_followers,
  pm.url AS poster_url, pm.width AS poster_w, pm.height AS poster_h,
  vm.url AS video_url, vm.mime AS video_mime, vm.width AS video_w, vm.height AS video_h,
  CASE WHEN $1::text IS NULL THEN false ELSE EXISTS (
    SELECT 1 FROM video_likes vl WHERE vl.video_id = v.id AND vl.user_id = $1::text
  ) END AS liked,
  CASE WHEN $1::text IS NULL THEN false ELSE EXISTS (
    SELECT 1 FROM video_saves vs WHERE vs.video_id = v.id AND vs.user_id = $1::text
  ) END AS saved,
  CASE WHEN $1::text IS NULL THEN false ELSE EXISTS (
    SELECT 1 FROM follows f WHERE f.author_id = v.author_id AND f.follower_id = $1::text
  ) END AS following
`;

const VIDEO_SOURCE = `
  FROM videos v
  JOIN profiles p ON p.user_id = v.author_id
  LEFT JOIN media pm ON pm.id = v.poster_media_id
  LEFT JOIN media vm ON vm.id = v.video_media_id
`;

// Handles are stored with the leading '@'; URLs carry the bare name.
export function normalizeHandle(value: string) {
  return `@${decodeURIComponent(value).replace(/^@+/, '').slice(0, 64)}`;
}

export function profilePath(handle: string | null) {
  if (!handle) return null;
  return `/u/${encodeURIComponent(handle.replace(/^@+/, ''))}`;
}

function pageSize(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), 120);
}

export async function getProfileByHandle({
  handle,
  viewerId = null,
}: { handle: string; viewerId?: string | null }): Promise<Profile | null> {
  const [row] = await sql<Profile[]>`
    SELECT
      p.user_id,
      p.handle,
      COALESCE(p.display_name, 'Creator') AS display_name,
      p.bio,
      p.avatar_color,
      p.followers_count,
      (SELECT COUNT(*) FROM videos v WHERE v.author_id = p.user_id)::integer AS posts_count,
      (SELECT COALESCE(SUM(v.likes_count), 0) FROM videos v WHERE v.author_id = p.user_id)::integer
        AS total_likes,
      -- profiles.level is a column nothing ever wrote to, so every account read
      -- "Lvl 1" forever. XP is counted from what the account actually did.
      (SELECT COALESCE(SUM(v.likes_count * 2 + v.saves_count * 3 + 10), 0)
       FROM videos v WHERE v.author_id = p.user_id)::integer AS xp,
      CASE WHEN ${viewerId}::text IS NULL THEN false ELSE EXISTS (
        SELECT 1 FROM follows f
        WHERE f.author_id = p.user_id AND f.follower_id = ${viewerId}::text
      ) END AS following
    FROM profiles p
    WHERE p.handle = ${normalizeHandle(handle)}
  `;
  if (!row) return null;
  return { ...row, level: levelFromXp(row.xp) };
}

export async function getVideosByAuthor({
  authorId,
  viewerId = null,
  limit = 60,
}: { authorId: string; viewerId?: string | null; limit?: number }): Promise<Video[]> {
  return sql.unsafe<Video[]>(
    `SELECT ${VIDEO_COLUMNS} ${VIDEO_SOURCE}
     WHERE v.author_id = $2::text
     ORDER BY v.created_at DESC, v.id DESC
     LIMIT ${pageSize(limit)}`,
    [viewerId, authorId],
  );
}

export async function getSavedVideos({
  userId,
  limit = 60,
}: { userId: string; limit?: number }): Promise<Video[]> {
  return sql.unsafe<Video[]>(
    `SELECT ${VIDEO_COLUMNS} ${VIDEO_SOURCE}
     JOIN video_saves saved ON saved.video_id = v.id AND saved.user_id = $2::text
     ORDER BY saved.created_at DESC, v.id DESC
     LIMIT ${pageSize(limit)}`,
    [userId, userId],
  );
}

export interface SuggestedAuthor {
  user_id: string;
  handle: string | null;
  display_name: string;
  avatar_color: string;
  followers_count: number;
  following: boolean;
}

export async function getSuggestedAuthors({
  viewerId,
  limit = 3,
}: {
  viewerId: string | null;
  limit?: number;
}): Promise<SuggestedAuthor[]> {
  return sql<SuggestedAuthor[]>`
    SELECT
      p.user_id,
      p.handle,
      COALESCE(p.display_name, 'Creator') AS display_name,
      p.avatar_color,
      p.followers_count,
      false AS following
    FROM profiles p
    WHERE (${viewerId}::text IS NULL OR p.user_id <> ${viewerId}::text)
      AND (${viewerId}::text IS NULL OR NOT EXISTS (
        SELECT 1 FROM follows f
        WHERE f.author_id = p.user_id AND f.follower_id = ${viewerId}::text
      ))
    ORDER BY p.followers_count DESC, p.user_id
    LIMIT ${pageSize(limit)}
  `;
}
