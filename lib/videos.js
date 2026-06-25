import 'server-only';
import { sql } from './db';

// NOTE: the Neon HTTP client does not support composing nested `sql` fragments,
// so the (identical) column list is inlined into the feed + single-video
// queries below. `userId` drives the per-user `liked` / `saved` / `following`
// flags (all false when signed out).

// Fetch the feed, optionally filtered by category.
export async function getFeed({ category = null, userId = null } = {}) {
  const rows = await sql`
    SELECT
      v.id, v.title, v.description, v.category, v.label, v.size, v.duration,
      v.likes_count, v.saves_count, v.comments_count, v.views_count, v.author_id,
      p.handle                            AS author_handle,
      COALESCE(p.display_name, 'Creator') AS author_name,
      p.avatar_color                      AS author_color,
      p.bio                               AS author_bio,
      p.followers_count                   AS author_followers,
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
    JOIN profiles p     ON p.user_id = v.author_id
    LEFT JOIN media pm  ON pm.id = v.poster_media_id
    LEFT JOIN media vm  ON vm.id = v.video_media_id
    WHERE ${category}::text IS NULL OR v.category = ${category}::text
    ORDER BY v.id ASC
  `;
  return rows;
}

// Fetch a single video (for the preview/detail view).
export async function getVideoById({ id, userId = null }) {
  const [row] = await sql`
    SELECT
      v.id, v.title, v.description, v.category, v.label, v.size, v.duration,
      v.likes_count, v.saves_count, v.comments_count, v.views_count, v.author_id,
      p.handle                            AS author_handle,
      COALESCE(p.display_name, 'Creator') AS author_name,
      p.avatar_color                      AS author_color,
      p.bio                               AS author_bio,
      p.followers_count                   AS author_followers,
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
    JOIN profiles p     ON p.user_id = v.author_id
    LEFT JOIN media pm  ON pm.id = v.poster_media_id
    LEFT JOIN media vm  ON vm.id = v.video_media_id
    WHERE v.id = ${id}
  `;
  return row ?? null;
}

// Toggle a like for a user/video and return the new state + count.
export async function toggleLike({ userId, videoId }) {
  const existing = await sql`
    SELECT 1 FROM video_likes WHERE user_id = ${userId} AND video_id = ${videoId} LIMIT 1
  `;
  if (existing.length > 0) {
    await sql`DELETE FROM video_likes WHERE user_id = ${userId} AND video_id = ${videoId}`;
    const [v] = await sql`
      UPDATE videos SET likes_count = GREATEST(likes_count - 1, 0)
      WHERE id = ${videoId} RETURNING likes_count
    `;
    return { liked: false, likes_count: v?.likes_count ?? 0 };
  }
  await sql`INSERT INTO video_likes (user_id, video_id) VALUES (${userId}, ${videoId})`;
  const [v] = await sql`
    UPDATE videos SET likes_count = likes_count + 1 WHERE id = ${videoId} RETURNING likes_count
  `;
  return { liked: true, likes_count: v?.likes_count ?? 0 };
}

// Toggle a save / favourite (收藏) and return the new state + count.
export async function toggleSave({ userId, videoId }) {
  const existing = await sql`
    SELECT 1 FROM video_saves WHERE user_id = ${userId} AND video_id = ${videoId} LIMIT 1
  `;
  if (existing.length > 0) {
    await sql`DELETE FROM video_saves WHERE user_id = ${userId} AND video_id = ${videoId}`;
    const [v] = await sql`
      UPDATE videos SET saves_count = GREATEST(saves_count - 1, 0)
      WHERE id = ${videoId} RETURNING saves_count
    `;
    return { saved: false, saves_count: v?.saves_count ?? 0 };
  }
  await sql`INSERT INTO video_saves (user_id, video_id) VALUES (${userId}, ${videoId})`;
  const [v] = await sql`
    UPDATE videos SET saves_count = saves_count + 1 WHERE id = ${videoId} RETURNING saves_count
  `;
  return { saved: true, saves_count: v?.saves_count ?? 0 };
}

// Toggle a follow (关注) between follower and author (a profile).
export async function toggleFollow({ followerId, authorId }) {
  if (!authorId || followerId === authorId) {
    return { following: false, followers_count: 0, self: true };
  }
  const existing = await sql`
    SELECT 1 FROM follows WHERE follower_id = ${followerId} AND author_id = ${authorId} LIMIT 1
  `;
  if (existing.length > 0) {
    await sql`DELETE FROM follows WHERE follower_id = ${followerId} AND author_id = ${authorId}`;
    const [p] = await sql`
      UPDATE profiles SET followers_count = GREATEST(followers_count - 1, 0)
      WHERE user_id = ${authorId} RETURNING followers_count
    `;
    return { following: false, followers_count: p?.followers_count ?? 0 };
  }
  await sql`INSERT INTO follows (follower_id, author_id) VALUES (${followerId}, ${authorId})`;
  const [p] = await sql`
    UPDATE profiles SET followers_count = followers_count + 1
    WHERE user_id = ${authorId} RETURNING followers_count
  `;
  return { following: true, followers_count: p?.followers_count ?? 0 };
}

// Comments for a video, newest first, with author display info.
export async function getComments(videoId) {
  return sql`
    SELECT
      c.id,
      c.body,
      c.created_at,
      c.user_id,
      COALESCE(p.display_name, 'You') AS author_name,
      p.handle        AS author_handle,
      p.avatar_color  AS author_color
    FROM comments c
    LEFT JOIN profiles p ON p.user_id = c.user_id
    WHERE c.video_id = ${videoId}
    ORDER BY c.created_at DESC
    LIMIT 200
  `;
}

// Add a comment and return the inserted row (joined with author info) + count.
export async function addComment({ userId, videoId, body }) {
  const text = String(body || '').trim().slice(0, 1000);
  if (!text) return null;

  const [row] = await sql`
    INSERT INTO comments (video_id, user_id, body)
    VALUES (${videoId}, ${userId}, ${text})
    RETURNING id, body, created_at, user_id
  `;
  const [v] = await sql`
    UPDATE videos SET comments_count = comments_count + 1
    WHERE id = ${videoId} RETURNING comments_count
  `;
  const [author] = await sql`
    SELECT COALESCE(display_name, 'You') AS author_name, handle AS author_handle, avatar_color AS author_color
    FROM profiles WHERE user_id = ${userId}
  `;
  return {
    comment: { ...row, ...(author ?? {}) },
    comments_count: v?.comments_count ?? 0,
  };
}

// Recent projects for a given user (Create studio).
export async function getProjects(userId) {
  if (!userId) return [];
  return sql`
    SELECT id, name, status, media_ids, created_at
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
}
