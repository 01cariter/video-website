'use client';

import { createAuthClient } from '@neondatabase/auth/next';

// ============================================================================
// Client-side Neon Auth instance (browser).
//
// Exposes Better Auth client methods used by the UI:
//   • authClient.signUp.email({ email, password, name })
//   • authClient.signIn.email({ email, password })
//   • authClient.signIn.social({ provider, callbackURL })   // 'google' | 'microsoft'
//   • authClient.signOut()
//   • authClient.getSession()
//
// The base URL is read automatically from NEON_AUTH_BASE_URL.
// ============================================================================
export const authClient = createAuthClient();
