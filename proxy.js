import { auth } from '@/lib/auth/server';

// Protect routes that require a signed-in user. Unauthenticated visitors are
// redirected to /login by Neon Auth.
export default auth.middleware({
  loginUrl: '/login',
});

export const config = {
  matcher: ['/create/:path*', '/create'],
};
