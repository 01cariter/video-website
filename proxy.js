import { auth } from '@/lib/auth/server';

// Protect routes that require a signed-in user. Unauthenticated visitors are
// redirected to /login by Neon Auth.
export default auth.middleware({
  loginUrl: '/login',
});

export const config = {
  // `/auth/complete` must be matched so Neon Auth can exchange the OAuth
  // verifier token (returned by Google/Microsoft) for a session cookie.
  matcher: ['/create/:path*', '/create', '/auth/complete'],
};
