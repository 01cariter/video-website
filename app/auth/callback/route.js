import { NextResponse } from 'next/server';
import { createClient } from '@/lib/auth/server';

export const runtime = 'nodejs';

// GET /auth/callback — exchanges the OAuth `code` (Google, etc.) for a
// Supabase session, then forwards the browser to `next`.
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const rawNext = url.searchParams.get('next') || '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL(`/login?error=oauth`, url.origin));
}
