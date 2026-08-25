import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabasePublishableKey, getSupabaseUrl } from './env';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export async function createClient(providedCookieStore?: CookieStore) {
  const cookieStore = providedCookieStore || await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. The proxy refreshes them.
        }
      },
    },
  });
}

// Per-request memo. Authorization must verify the cookie-backed JWT with
// Supabase Auth; getSession() only decodes local cookie data and is not safe
// for protecting server-side data or mutations.
export const getAuthUser = cache(async () => {
  const cookieStore = await cookies();
  const projectRef = new URL(getSupabaseUrl()).hostname.split('.')[0];
  const authCookie = `sb-${projectRef}-auth-token`;
  const hasSession = cookieStore.getAll().some(({ name }) =>
    name === authCookie || name.startsWith(`${authCookie}.`),
  );
  if (!hasSession) return null;

  const supabase = await createClient(cookieStore);
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
});

// Compatibility alias for routes that previously opted into verification.
// All server authorization now uses the same verified boundary.
export const getVerifiedAuthUser = getAuthUser;
