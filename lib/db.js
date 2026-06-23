import { neon } from '@neondatabase/serverless';

// Runtime database client (Neon serverless / HTTP).
// `DATABASE_URL` is provided by the Neon Vercel integration (or `.env.local`).
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to .env.local or your Vercel project.');
}

export const sql = neon(process.env.DATABASE_URL);
