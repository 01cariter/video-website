// Shared Supabase Postgres client for the CLI scripts (setup / seed).
// Loads env from .env / .env.local so you can run `npm run db:setup` locally.
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
config({ path: '.env.development.local' });
config(); // fallback to .env

const url =
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (!url) {
  console.error('\n  ✗ SUPABASE_DB_URL is not set.');
  console.error('    Copy .env.example to .env.local and paste your Supabase connection string.\n');
  process.exit(1);
}

export const sql = postgres(url, {
  prepare: false,
  ssl: 'require',
});
