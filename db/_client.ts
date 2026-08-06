import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
config();

const databaseUrl =
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!databaseUrl) {
  throw new Error(
    'POSTGRES_URL is not set. Pull the Vercel Supabase environment variables or add SUPABASE_DATABASE_URL.',
  );
}

const isLocal = /(?:localhost|127\.0\.0\.1)/.test(databaseUrl);

export const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: isLocal ? false : 'require',
});
