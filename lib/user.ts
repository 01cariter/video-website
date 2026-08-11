import 'server-only';

import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { getAuthUser } from './supabase/server';
import { sql } from './db';
import { levelFromXp } from './levels';
import type { AppUser } from './types';

const AVATAR_COLORS = ['#3f7d92', '#cf4f2a', '#4a7a6a', '#52708f', '#b06a3a', '#5f7d78'];

interface ProfileRow extends Record<string, unknown> {
  handle: string | null;
  avatar_color: string;
  followers_count: number;
}

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function displayNameFor(user: User) {
  return (
    user.user_metadata.full_name ||
    user.user_metadata.name ||
    user.email?.split('@')[0] ||
    'You'
  ) as string;
}

function avatarUrlFor(user: User) {
  return (user.user_metadata.avatar_url || user.user_metadata.picture || null) as string | null;
}

function deriveHandle(user: User) {
  const base =
    displayNameFor(user)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 16) || 'user';
  const suffix = user.id.replace(/[^a-z0-9]/gi, '').slice(-4) || '0000';
  return `@${base}_${suffix}`;
}

// Per-request memo: layout + page both call this on every navigation.
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const authUser = await getAuthUser();
  if (!authUser?.id) return null;

  const displayName = displayNameFor(authUser);
  const handle = deriveHandle(authUser);

  // Fast path: no XP SUM over all posts on every route change.
  const [existing] = await sql<ProfileRow[]>`
    SELECT handle, avatar_color, followers_count
    FROM profiles
    WHERE user_id = ${authUser.id}
  `;

  let profile = existing;
  if (!profile) {
    const [created] = await sql<ProfileRow[]>`
      INSERT INTO profiles (user_id, display_name, handle, avatar_color)
      VALUES (${authUser.id}, ${displayName}, ${handle}, ${randomColor()})
      ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING handle, avatar_color, followers_count
    `;
    profile = created;
  }

  if (!profile) throw new Error('Could not load the current user profile.');

  return {
    id: authUser.id,
    display_name: displayName,
    handle: profile.handle,
    email: authUser.email ?? null,
    avatar_url: avatarUrlFor(authUser),
    avatar_color: profile.avatar_color,
    // XP/level are profile-page concerns; shell does not need a live SUM.
    xp: 0,
    level: levelFromXp(0),
    followers_count: profile.followers_count,
  };
});
