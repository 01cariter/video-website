import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// ============================================================================
// Server-side Supabase client (App Router).
//
// Used from Server Components, Route Handlers and Server Actions. Reads/writes
// the auth cookies via Next's `cookies()` API. In a Server Component, cookie
// writes are a no-op (Next forbids it there) — the middleware is responsible
// for refreshing the session cookie on navigation.
//
// Env (see .env.example):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
// ============================================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local (see .env.example).');
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Add it to .env.local (see .env.example).');
}

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // `setAll` is called from a Server Component during render, where
          // Next.js forbids writing cookies. Safe to ignore — the middleware
          // (proxy.js) refreshes the session cookie on the next navigation.
        }
      },
    },
  });
}

// Returns the current Supabase auth user, or null when signed out.
export async function getAuthUser() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}
