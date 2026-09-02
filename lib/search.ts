import 'server-only';

import { sql } from './db';
import { VIDEO_COLUMNS, VIDEO_SOURCE } from './profiles';
import { likePattern, normalizeSearchQuery } from './search-shared';
import type {
  SearchPostSuggestion,
  SearchSuggestionPerson,
  SearchSuggestions,
} from './search-types';
import type { ProfileSummary, Video } from './types';
import { attachVideoAssets } from './videos';

export { likePattern, normalizeSearchQuery, MAX_SEARCH_QUERY_LENGTH } from './search-shared';
export type {
  SearchPostSuggestion,
  SearchSuggestionPerson,
  SearchSuggestions,
} from './search-types';

export async function searchVideos({
  query,
  viewerId = null,
  limit = 40,
}: {
  query: string;
  viewerId?: string | null;
  limit?: number;
}): Promise<Video[]> {
  const term = normalizeSearchQuery(query);
  if (!term) return [];
  const pattern = likePattern(term);
  const rows = await sql.unsafe<Video[]>(
    `SELECT ${VIDEO_COLUMNS} ${VIDEO_SOURCE}
     WHERE v.title ILIKE $2 ESCAPE '\\'
        OR v.description ILIKE $2 ESCAPE '\\'
        OR p.display_name ILIKE $2 ESCAPE '\\'
        OR p.handle ILIKE $2 ESCAPE '\\'
     ORDER BY
       -- A title hit is what the reader most likely meant; the author's name
       -- ranks last so searching a creator still surfaces their newest work.
       CASE
         WHEN v.title ILIKE $2 ESCAPE '\\' THEN 0
         WHEN v.description ILIKE $2 ESCAPE '\\' THEN 1
         ELSE 2
       END,
       v.likes_count DESC,
       v.created_at DESC,
       v.id DESC
     LIMIT ${Math.min(Math.max(Math.trunc(limit), 1), 60)}`,
    [viewerId, pattern],
  );
  return attachVideoAssets(rows.map((row) => ({ ...row, assets: row.assets ?? [] })));
}

export async function searchProfiles({
  query,
  viewerId = null,
  limit = 12,
}: {
  query: string;
  viewerId?: string | null;
  limit?: number;
}): Promise<ProfileSummary[]> {
  const term = normalizeSearchQuery(query);
  if (!term) return [];
  const pattern = likePattern(term);
  return sql<ProfileSummary[]>`
    SELECT
      p.user_id,
      p.handle,
      COALESCE(p.display_name, 'Creator') AS display_name,
      p.bio,
      p.avatar_color,
      am.url AS avatar_url,
      (SELECT COUNT(*) FROM follows f WHERE f.author_id = p.user_id)::integer AS followers_count,
      (SELECT COUNT(*) FROM videos v WHERE v.author_id = p.user_id)::integer AS posts_count,
      CASE WHEN ${viewerId}::text IS NULL THEN false ELSE EXISTS (
        SELECT 1 FROM follows f
        WHERE f.author_id = p.user_id AND f.follower_id = ${viewerId}::text
      ) END AS following
    FROM profiles p
    LEFT JOIN media am ON am.id = p.avatar_media_id
    WHERE p.handle ILIKE ${pattern} ESCAPE '\\'
       OR p.display_name ILIKE ${pattern} ESCAPE '\\'
       OR p.bio ILIKE ${pattern} ESCAPE '\\'
    ORDER BY
      CASE WHEN p.handle ILIKE ${pattern} ESCAPE '\\' THEN 0 ELSE 1 END,
      p.followers_count DESC,
      p.user_id
    LIMIT ${Math.min(Math.max(Math.trunc(limit), 1), 40)}
  `;
}

/**
 * Typeahead runs on every debounced keystroke, so it deliberately skips the
 * full feed projection and the asset join that `searchVideos` needs — a
 * headline and an author is all the dropdown renders.
 */
export async function suggestSearch({
  query,
  peopleLimit = 3,
  postLimit = 5,
}: {
  query: string;
  peopleLimit?: number;
  postLimit?: number;
}): Promise<SearchSuggestions> {
  const term = normalizeSearchQuery(query);
  if (!term) return { people: [], posts: [] };
  const pattern = likePattern(term);

  const [people, posts] = await Promise.all([
    sql<SearchSuggestionPerson[]>`
      SELECT
        p.user_id,
        p.handle,
        COALESCE(p.display_name, 'Creator') AS display_name,
        p.avatar_color,
        am.url AS avatar_url,
        p.followers_count
      FROM profiles p
      LEFT JOIN media am ON am.id = p.avatar_media_id
      WHERE p.handle ILIKE ${pattern} ESCAPE '\\'
         OR p.display_name ILIKE ${pattern} ESCAPE '\\'
      ORDER BY
        CASE WHEN p.handle ILIKE ${pattern} ESCAPE '\\' THEN 0 ELSE 1 END,
        p.followers_count DESC,
        p.user_id
      LIMIT ${Math.min(Math.max(Math.trunc(peopleLimit), 1), 8)}
    `,
    sql<SearchPostSuggestion[]>`
      SELECT
        v.id,
        COALESCE(
          NULLIF(TRIM(v.title), ''),
          NULLIF(LEFT(TRIM(v.description), 80), ''),
          'Post'
        ) AS headline,
        COALESCE(p.display_name, 'Creator') AS author_name,
        p.handle AS author_handle
      FROM videos v
      JOIN profiles p ON p.user_id = v.author_id
      WHERE v.title ILIKE ${pattern} ESCAPE '\\'
         OR v.description ILIKE ${pattern} ESCAPE '\\'
      ORDER BY
        CASE WHEN v.title ILIKE ${pattern} ESCAPE '\\' THEN 0 ELSE 1 END,
        v.likes_count DESC,
        v.created_at DESC,
        v.id DESC
      LIMIT ${Math.min(Math.max(Math.trunc(postLimit), 1), 10)}
    `,
  ]);

  return { people, posts };
}
