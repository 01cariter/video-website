// ============================================================================
// Production schema rebuild (destructive — drops all data).
//
// The production DB was still on the old v1 schema, which is incompatible with
// the current code (expects v2: media table, profiles-as-creator, author_id…).
// This rebuilds everything from scratch: v2 schema + canvas migration + demo
// seed. No data is preserved.
//
// Usage:  npm run db:fix-prod
// ============================================================================
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sql } from './_client.mjs';
import { seed } from './seed.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function splitStatements(file) {
  return file
    .split('\n')
    // Strip line comments, including inline ones (`col TEXT, -- note`).
    .map((line) => {
      const i = line.indexOf('--');
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function runSqlFile(name) {
  const file = await readFile(join(__dirname, name), 'utf8');
  const statements = splitStatements(file);
  for (const statement of statements) await sql(statement);
  console.log(`  ✓ ${name} applied (${statements.length} statements).`);
}

async function main() {
  console.log('\n  Rebuilding production database from scratch…\n');

  // Drop leftover canvas tables first (they reference projects via FK).
  console.log('  • Dropping stale tables…');
  await sql`DROP TABLE IF EXISTS agent_messages CASCADE`;

  console.log('  • Rebuilding v2 schema…');
  await runSqlFile('schema.sql'); // drops + recreates all business tables
  await runSqlFile('canvas.sql'); // adds canvas columns + agent_messages table

  console.log('  • Seeding demo feed…');
  await seed();

  console.log('\n  ✓ Database rebuilt.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('  ✗ Rebuild failed:', err);
    process.exit(1);
  });
