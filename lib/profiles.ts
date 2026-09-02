import 'server-only';

import { sql } from './db';
import { MAX_BIO_LENGTH, MAX_DISPLAY_NAME_LENGTH } from './profiles-shared';
import { levelFromXp } from './levels';
import type { Profile, ProfileSummary, Video } from './types';
import { attachVideoAssets } from './videos';

// The feed projection, reused by every profile listing and by search. `$1` is
// the viewer id (nullable); later placeholders belong to the caller's WHERE.
export const VIDEO_COLUMNS = `
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

export const VIDEO_SOURCE = `
  FROM videos v
  JOIN profiles p ON p.user_id = v.author_id
  LEFT JOIN media pm ON pm.id = v.poster_media_id
  LEFT JOIN media vm ON vm.id = v.video_media_id
  LEFT JOIN media am ON am.id = p.avatar_media_id
  LEFT JOIN collections c ON c.id = v.collection_id
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

export { MAX_BIO_LENGTH, MAX_DISPLAY_NAME_LENGTH };

export interface ProfileEdit {
  display_name: string;
  bio: string | null;
  avatar_media_id: number | null;
}


// The direct Postgres connection bypasses RLS, so ownership of the chosen
// avatar is re-checked here rather than trusted from the browser.
export async function updateProfile({
  userId,
  displayName,
  bio,
  avatarMediaId,
}: {
  userId: string;
  displayName: string;
  bio: string | null;
  avatarMediaId: number | null;
}): Promise<ProfileEdit> {
  if (avatarMediaId !== null) {
    const [owned] = await sql<Array<{ id: number }>>`
      SELECT id FROM media
      WHERE id = ${avatarMediaId} AND owner_id = ${userId} AND kind = 'image'
    `;
    if (!owned) throw new Error('That avatar image is not available.');
  }

  const [row] = await sql<ProfileEdit[]>`
    UPDATE profiles
    SET display_name = ${displayName},
        bio = ${bio},
        avatar_media_id = ${avatarMediaId}
    WHERE user_id = ${userId}
    RETURNING display_name, bio, avatar_media_id
  `;
  if (!row) throw new Error('Profile not found.');
  return row;
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
      am.url AS avatar_url,
      p.avatar_media_id,
      (SELECT COUNT(*) FROM follows f WHERE f.author_id = p.user_id)::integer AS followers_count,
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
    LEFT JOIN media am ON am.id = p.avatar_media_id
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
  const rows = await sql.unsafe<Video[]>(
    `SELECT ${VIDEO_COLUMNS} ${VIDEO_SOURCE}
     WHERE v.author_id = $2::text
     ORDER BY v.created_at DESC, v.id DESC
     LIMIT ${pageSize(limit)}`,
    [viewerId, authorId],
  );
  return attachVideoAssets(rows.map((row) => ({ ...row, assets: row.assets ?? [] })));
}

export async function getSavedVideos({
  userId,
  limit = 60,
}: { userId: string; limit?: number }): Promise<Video[]> {
  const rows = await sql.unsafe<Video[]>(
    `SELECT ${VIDEO_COLUMNS} ${VIDEO_SOURCE}
     JOIN video_saves saved ON saved.video_id = v.id AND saved.user_id = $2::text
     ORDER BY saved.created_at DESC, v.id DESC
     LIMIT ${pageSize(limit)}`,
    [userId, userId],
  );
  return attachVideoAssets(rows.map((row) => ({ ...row, assets: row.assets ?? [] })));
}

export async function getProfileFollowers({
  authorId,
  viewerId = null,
  limit = 120,
}: {
  authorId: string;
  viewerId?: string | null;
  limit?: number;
}): Promise<ProfileSummary[]> {
  return sql<ProfileSummary[]>`
    SELECT
      p.user_id,
      p.handle,
      COALESCE(p.display_name, 'Creator') AS display_name,
      p.bio,
      p.avatar_color,
      am.url AS avatar_url,
      (SELECT COUNT(*) FROM follows own_followers WHERE own_followers.author_id = p.user_id)::integer
        AS followers_count,
      (SELECT COUNT(*) FROM videos own_posts WHERE own_posts.author_id = p.user_id)::integer
        AS posts_count,
      CASE WHEN ${viewerId}::text IS NULL THEN false ELSE EXISTS (
        SELECT 1 FROM follows viewer_follow
        WHERE viewer_follow.author_id = p.user_id
          AND viewer_follow.follower_id = ${viewerId}::text
      ) END AS following
    FROM follows profile_follow
    JOIN profiles p ON p.user_id = profile_follow.follower_id
    LEFT JOIN media am ON am.id = p.avatar_media_id
    WHERE profile_follow.author_id = ${authorId}
    ORDER BY profile_follow.created_at DESC, p.user_id
    LIMIT ${pageSize(limit)}
  `;
}

export async function getFollowingAuthors({
  userId,
  limit = 120,
}: {
  userId: string;
  limit?: number;
}): Promise<ProfileSummary[]> {
  return sql<ProfileSummary[]>`
    SELECT
      p.user_id,
      p.handle,
      COALESCE(p.display_name, 'Creator') AS display_name,
      p.bio,
      p.avatar_color,
      am.url AS avatar_url,
      (SELECT COUNT(*) FROM follows own_followers WHERE own_followers.author_id = p.user_id)::integer
        AS followers_count,
      (SELECT COUNT(*) FROM videos own_posts WHERE own_posts.author_id = p.user_id)::integer
        AS posts_count,
      true AS following
    FROM follows viewer_follow
    JOIN profiles p ON p.user_id = viewer_follow.author_id
    LEFT JOIN media am ON am.id = p.avatar_media_id
    WHERE viewer_follow.follower_id = ${userId}
    ORDER BY viewer_follow.created_at DESC, p.user_id
    LIMIT ${pageSize(limit)}
  `;
}

export interface SuggestedAuthor {
  user_id: string;
  handle: string | null;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
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
      am.url AS avatar_url,
      p.followers_count,
      false AS following
    FROM profiles p
    LEFT JOIN media am ON am.id = p.avatar_media_id
    WHERE (${viewerId}::text IS NULL OR p.user_id <> ${viewerId}::text)
      AND (${viewerId}::text IS NULL OR NOT EXISTS (
        SELECT 1 FROM follows f
        WHERE f.author_id = p.user_id AND f.follower_id = ${viewerId}::text
      ))
    ORDER BY p.followers_count DESC, p.user_id
    LIMIT ${pageSize(limit)}
  `;
}
