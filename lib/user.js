import 'server-only';
import { getAuthUser } from './auth/server';
import { sql } from './db';

// ============================================================================
// Bridge between Supabase Auth (the signed-in identity) and the app's profile
// data.
//
// Supabase Auth owns the user record (id, email, user_metadata) in the
// managed `auth.users` table. App-specific fields (avatar colour, level,
// streak) live in our `profiles` table, keyed by the Supabase auth user id
// (a UUID). We find-or-create the profile on demand so the UI always has
// something to render.
// ============================================================================

const AVATAR_COLORS = ['#3f7d92', '#cf4f2a', '#4a7a6a', '#52708f', '#b06a3a', '#5f7d78'];

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Build a stable, unique-ish @handle from the user's name/email + id suffix.
function deriveHandle(u) {
  const base = (u.name || (u.email ? u.email.split('@')[0] : 'user'))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16) || 'user';
  const suffix = String(u.id).replace(/[^a-z0-9]/gi, '').slice(-4) || '0000';
  return `@${base}_${suffix}`;
}

// Returns the merged app user for the current request, or null when signed out.
// Persists the user's display name + handle into `profiles` so they show up as
// a real "creator" on authored videos and comments.
export async function getCurrentUser() {
  const authUser = await getAuthUser();
  if (!authUser?.id) return null;

  const meta = authUser.user_metadata || {};
  const name = meta.full_name || meta.name || null;
  const image = meta.avatar_url || meta.picture || null;

  const u = { id: authUser.id, name, email: authUser.email ?? null, image };
  const displayName = u.name || (u.email ? u.email.split('@')[0] : 'You');
  const handle = deriveHandle(u);

  // Find-or-create the profile row, keeping display_name fresh from Supabase Auth.
  // `handle` is only set on first insert (kept stable afterwards).
  const [profile] = await sql`
    INSERT INTO profiles (user_id, display_name, handle, avatar_color)
    VALUES (${u.id}, ${displayName}, ${handle}, ${randomColor()})
    ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name
    RETURNING handle, avatar_color, level, streak, followers_count
  `;

  return {
    id: u.id,
    display_name: displayName,
    handle: profile.handle,
    email: u.email ?? null,
    avatar_url: u.image ?? null,
    avatar_color: profile.avatar_color,
    level: profile.level,
    streak: profile.streak,
    followers_count: profile.followers_count,
  };
}
