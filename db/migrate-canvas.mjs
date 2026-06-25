// ============================================================================
// Apply the AI canvas migration (db/canvas.sql) to Neon.
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
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql(statement);
  }
  console.log(`  ✓ Migration applied (${statements.length} statements).\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('  ✗ Migration failed:', err);
    process.exit(1);
  });
