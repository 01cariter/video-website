'use client';

import { createBrowserClient } from '@supabase/ssr';

// ============================================================================
// Client-side Supabase instance (browser).
//
// Exposes the Supabase JS auth API used by the UI:
//   • supabase.auth.signUp({ email, password, options: { data: { name } } })
//   • supabase.auth.signInWithPassword({ email, password })
//   • supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
//   • supabase.auth.signOut()
//   • supabase.auth.getSession()
// ============================================================================
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
