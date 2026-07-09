import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ============================================================================
// Supabase session refresh + route protection.
//
// Per the @supabase/ssr middleware pattern: read/refresh the session on every
// matched request so Server Components downstream see a fresh cookie, and
// redirect unauthenticated visitors away from protected routes.
// ============================================================================
export default async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = pathname === '/create' || pathname.startsWith('/create/');
  if (isProtected && !data.user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/create/:path*', '/create'],
};
