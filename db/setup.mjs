// ============================================================================
// One-shot DB setup: create the schema, then seed the mock data.
// Usage:  npm run db:setup
// ============================================================================
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sql } from './_client.mjs';
import { seed } from './seed.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function applySchema() {
  console.log('  • Applying schema.sql…');
  const file = await readFile(join(__dirname, 'schema.sql'), 'utf8');

  // Strip comments, then split into individual statements.
  const statements = splitStatements(file);

  for (const statement of statements) {
    await sql.unsafe(statement);
  }
  console.log(`  ✓ Schema applied (${statements.length} statements).`);
}

function splitStatements(file) {
  return file
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  console.log('\n  Setting up the Video Website database on Supabase Postgres…\n');
  await applySchema();
  await seed();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('  ✗ Setup failed:', err);
    process.exit(1);
  });
