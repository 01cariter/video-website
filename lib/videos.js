import 'server-only';
import { sql } from './db';

// Fetch the feed, optionally filtered by category, with a `liked` flag for the
// signed-in user (if any).
export async function getFeed({ category = null, userId = null } = {}) {
  const rows = await sql`
    SELECT
      v.id,
      v.title,
      v.category,
      v.label,
      v.size,
      v.image_id,
      v.duration,
      v.likes_count,
      c.handle       AS creator_handle,
      c.display_name AS creator_name,
      CASE
        WHEN ${userId}::text IS NULL THEN false
        ELSE EXISTS (
          SELECT 1 FROM video_likes vl
          WHERE vl.video_id = v.id AND vl.user_id = ${userId}::text
        )
      END AS liked
    FROM videos v
    JOIN creators c ON c.id = v.creator_id
    WHERE ${category}::text IS NULL OR v.category = ${category}::text
    ORDER BY v.id ASC
  `;
  return rows;
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
    UPDATE videos SET likes_count = likes_count + 1
    WHERE id = ${videoId} RETURNING likes_count
  `;
  return { liked: true, likes_count: v?.likes_count ?? 0 };
}

// Recent projects for a given user (Create studio).
export async function getProjects(userId) {
  if (!userId) return [];
  return sql`
    SELECT id, name, status, image_ids, created_at
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
}
