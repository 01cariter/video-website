// Shared Neon client for the CLI scripts (setup / seed).
// Loads env from .env / .env.local so you can run `npm run db:setup` locally.
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });
config(); // fallback to .env

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('\n  ✗ DATABASE_URL is not set.');
  console.error('    Copy .env.example to .env.local and paste your Neon connection string.\n');
  process.exit(1);
}

export const sql = neon(url);
