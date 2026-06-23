import { auth } from '@/lib/auth/server';

export const runtime = 'nodejs';

// Catch-all Neon Auth endpoint. Handles sign-in / sign-up / sign-out /
// get-session and OAuth callbacks (e.g. /api/auth/callback/google).
export const { GET, POST } = auth.handler();
