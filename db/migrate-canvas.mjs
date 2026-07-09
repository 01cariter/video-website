// ============================================================================
// Apply the AI canvas migration (db/canvas.sql) to Supabase Postgres.
// Usage:  npm run db:canvas
// ============================================================================
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sql } from './_client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('\n  Applying AI canvas migration…\n');
  const file = await readFile(join(__dirname, 'canvas.sql'), 'utf8');

  const statements = file
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.unsafe(statement);
  }
  console.log(`  ✓ Migration applied (${statements.length} statements).\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('  ✗ Migration failed:', err);
    process.exit(1);
  });
