// Shared Supabase Postgres client for the CLI scripts (setup / seed).
// Loads env from .env / .env.local so you can run `npm run db:setup` locally.
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
config(); // fallback to .env

const url =
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error('\n  ✗ POSTGRES_URL is not set.');
  console.error('    Pull Vercel Supabase integration env vars or add SUPABASE_DATABASE_URL to .env.local.\n');
  process.exit(1);
}

const isLocal = /(?:localhost|127\.0\.0\.1)/.test(url);

export const sql = postgres(url, {
  max: 1,
  prepare: false,
  ssl: isLocal ? false : 'require',
});
