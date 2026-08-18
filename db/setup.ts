import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPostgresUrl } from '../lib/supabase/env';
import { sql } from './_client';
import { seed } from './seed';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const databaseUrl = getPostgresUrl();

function splitStatements(file: string) {
  return file
    .split('\n')
    .map((line) => {
      const commentIndex = line.indexOf('--');
      return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    })
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function applySchema() {
  console.log('  Applying schema.sql...');
  const file = await readFile(join(currentDirectory, 'schema.sql'), 'utf8');
  const statements = splitStatements(file);
  for (const statement of statements) {
    await sql.unsafe(statement);
  }
  console.log(`  Schema applied (${statements.length} statements).`);
}

async function applySupabaseMigrations() {
  console.log('  Applying Supabase migrations...');
  const migrationsDirectory = join(
    currentDirectory,
    '..',
    'supabase',
    'migrations',
  );
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const migration = await readFile(join(migrationsDirectory, file), 'utf8');
    await sql.unsafe(migration);
    console.log(`  Applied ${file}.`);
  }
}

async function main() {
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(databaseUrl);
  if (!isLocal && process.env.ALLOW_DESTRUCTIVE_DB_SETUP !== '1') {
    throw new Error(
      'db:setup recreates every business table. Use the Supabase migrations in production, or set ALLOW_DESTRUCTIVE_DB_SETUP=1 explicitly.',
    );
  }
  console.log('\n  Setting up the Snackd database on Supabase Postgres...\n');
  await applySchema();
  await applySupabaseMigrations();
  await seed();
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('  Setup failed:', error);
    process.exit(1);
  });
