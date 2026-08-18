import { config } from 'dotenv';
import postgres from 'postgres';
import { getPostgresUrl } from '../lib/supabase/env';

config({ path: '.env.local' });
config();

const databaseUrl = getPostgresUrl();

const isLocal = /(?:localhost|127\.0\.0\.1)/.test(databaseUrl);

export const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: isLocal ? false : 'require',
});
