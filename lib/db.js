import postgres from 'postgres';

// ============================================================================
// Runtime database client — Supabase Postgres (via `postgres.js`).
//
// Uses the Supabase transaction pooler connection string (pgbouncer, port
// 6543) so it works well in serverless functions. `prepare: false` is
// required when talking through pgbouncer's transaction pooling mode.
// ============================================================================
const url =
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'SUPABASE_DB_URL (or POSTGRES_URL / DATABASE_URL) is not set. Add it to .env.local or your Vercel project.',
  );
}

export const sql = postgres(url, {
  prepare: false,
  ssl: 'require',
});
