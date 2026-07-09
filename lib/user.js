import 'server-only';
import { getAuthUser } from './supabase/server';
import { sql } from './db';

// ============================================================================
// Bridge between Supabase Auth and the app's profile data.
// ============================================================================

const AVATAR_COLORS = ['#3f7d92', '#cf4f2a', '#4a7a6a', '#52708f', '#b06a3a', '#5f7d78'];

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function displayNameFor(u) {
  return (
    u.user_metadata?.full_name ||
    u.user_metadata?.name ||
    u.email?.split('@')[0] ||
    'You'
  );
}

function avatarUrlFor(u) {
  return u.user_metadata?.avatar_url || u.user_metadata?.picture || null;
}

// Build a stable, unique-ish @handle from the user's name/email + id suffix.
function deriveHandle(u) {
  const base = (displayNameFor(u) || (u.email ? u.email.split('@')[0] : 'user'))
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
  const u = await getAuthUser();
  if (!u?.id) return null;

  const displayName = displayNameFor(u);
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
    avatar_url: avatarUrlFor(u),
    avatar_color: profile.avatar_color,
    level: profile.level,
    streak: profile.streak,
    followers_count: profile.followers_count,
  };
}
