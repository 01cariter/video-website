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
  const statements = file
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    // Neon's HTTP client (`neon()`) has no `.query()` method; it supports
    // tagged-template usage or plain function usage `sql(queryString)`.
    await sql(statement);
  }
  console.log(`  ✓ Schema applied (${statements.length} statements).`);
}

async function main() {
  console.log('\n  Setting up the Video Website database on Neon…\n');
  await applySchema();
  await seed();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('  ✗ Setup failed:', err);
    process.exit(1);
  });
