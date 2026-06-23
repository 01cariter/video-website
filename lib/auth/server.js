import { createNeonAuth } from '@neondatabase/auth/next/server';

// ============================================================================
// Server-side Neon Auth instance.
//
// This single instance provides:
//   • auth.handler()      — the catch-all API route (app/api/auth/[...path])
//   • auth.middleware()   — route protection (middleware.js)
//   • auth.getSession()   — read the current session in Server Components
//   • auth.signIn / signUp / signOut — Better Auth server methods
//
// Configure via env (see .env.example):
//   NEON_AUTH_BASE_URL       — copied from the Neon Console (Auth → Configuration)
//   NEON_AUTH_COOKIE_SECRET  — 32+ char secret (openssl rand -base64 32)
//
// NOTE: no `server-only` import here because middleware.js also imports `auth`.
// ============================================================================
if (!process.env.NEON_AUTH_BASE_URL) {
  throw new Error('NEON_AUTH_BASE_URL is not set. Add it to .env.local (see .env.example).');
}
if (!process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error('NEON_AUTH_COOKIE_SECRET is not set. Add it to .env.local (see .env.example).');
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
  },
});
