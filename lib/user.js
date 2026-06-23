import 'server-only';
import { auth } from './auth/server';
import { sql } from './db';

// ============================================================================
// Bridge between Neon Auth (the signed-in identity) and the app's profile data.
//
// Neon Auth owns the user record (id, name, email, image) in the managed
// `neon_auth` schema. App-specific fields (avatar colour, level, streak) live
// in our `profiles` table, keyed by the Neon Auth user id. We find-or-create
// the profile on demand so the UI always has something to render.
// ============================================================================

const AVATAR_COLORS = ['#3f7d92', '#cf4f2a', '#4a7a6a', '#52708f', '#b06a3a', '#5f7d78'];

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Returns the merged app user for the current request, or null when signed out.
export async function getCurrentUser() {
  const { data: session } = await auth.getSession();
  const u = session?.user;
  if (!u?.id) return null;

  // Find-or-create the profile row. The no-op UPDATE lets RETURNING work even
  // when the row already exists.
  const [profile] = await sql`
    INSERT INTO profiles (user_id, avatar_color)
    VALUES (${u.id}, ${randomColor()})
    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING avatar_color, level, streak
  `;

  const displayName =
    u.name || (u.email ? u.email.split('@')[0] : 'You');

  return {
    id: u.id,
    display_name: displayName,
    email: u.email ?? null,
    avatar_url: u.image ?? null,
    avatar_color: profile.avatar_color,
    level: profile.level,
    streak: profile.streak,
  };
}
