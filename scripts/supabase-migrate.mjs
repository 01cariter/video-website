import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
config();

const argumentsSet = new Set(process.argv.slice(2));
const isDryRun = argumentsSet.has('--dry-run');
const isVercelBuild = argumentsSet.has('--vercel-build');
const isProduction =
  process.env.VERCEL_ENV === 'production' ||
  process.env.VERCEL_TARGET_ENV === 'production';
const lockName = 'video-website:production:supabase-migrations';
const lockTimeoutMs = 120_000;

const connectionKeys = [
  'VIDEO_WEB_POSTGRES_URL_NON_POOLING',
  'SUPABASE_DB_URL',
  'SUPABASE_DATABASE_URL',
  'POSTGRES_URL_NON_POOLING',
];

function parseSupabaseConnection(key) {
  const value = process.env[key];
  if (!value) return null;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isPostgres =
      url.protocol === 'postgres:' || url.protocol === 'postgresql:';
    const isSupabase =
      hostname === 'supabase.co' ||
      hostname.endsWith('.supabase.co') ||
      hostname === 'supabase.com' ||
      hostname.endsWith('.supabase.com');
    const isTransactionPooler = url.port === '6543';

    if (!isPostgres || !isSupabase || isTransactionPooler) return null;

    return { key, value, hostname };
  } catch {
    return null;
  }
}

function getSupabaseConnection() {
  for (const key of connectionKeys) {
    const connection = parseSupabaseConnection(key);
    if (connection) return connection;
  }

  const presentKeys = connectionKeys.filter((key) => process.env[key]);
  const detail =
    presentKeys.length > 0
      ? `Present but rejected: ${presentKeys.join(', ')}.`
      : 'No supported database URL is present.';

  throw new Error(
    `A direct/session Supabase database URL is required. ${detail}`,
  );
}

function runSupabase(args) {
  const executable = resolve(
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'supabase.cmd' : 'supabase',
  );

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, args, {
      env: process.env,
      stdio: 'inherit',
    });

    child.on('error', rejectPromise);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          signal
            ? `Supabase CLI terminated by ${signal}.`
            : `Supabase CLI exited with code ${code ?? 'unknown'}.`,
        ),
      );
    });
  });
}

async function acquireLock(sql) {
  const deadline = Date.now() + lockTimeoutMs;

  while (Date.now() < deadline) {
    const [result] = await sql`
      select pg_try_advisory_lock(
        hashtextextended(${lockName}, 0)
      ) as acquired
    `;

    if (result?.acquired) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }

  throw new Error('Timed out waiting for the database migration lock.');
}

async function migrate() {
  if (isVercelBuild && !isProduction) {
    console.log('[db:migrate] Skipped outside Vercel Production.');
    return;
  }

  if (!isDryRun && !(isVercelBuild && isProduction)) {
    throw new Error(
      'Refusing to apply migrations outside a Vercel Production build.',
    );
  }

  const connection = getSupabaseConnection();
  console.log(
    `[db:migrate] ${isDryRun ? 'Checking' : 'Applying'} migrations with ${connection.key} (${connection.hostname}).`,
  );

  const sql = postgres(connection.value, {
    max: 1,
    prepare: false,
    ssl: 'require',
    connect_timeout: 15,
  });
  let locked = false;

  try {
    await acquireLock(sql);
    locked = true;

    const args = ['db', 'push', '--db-url', connection.value, '--yes'];
    if (isDryRun) args.push('--dry-run');
    await runSupabase(args);
  } finally {
    if (locked) {
      await sql`
        select pg_advisory_unlock(
          hashtextextended(${lockName}, 0)
        )
      `;
    }
    await sql.end({ timeout: 5 });
  }
}

migrate().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[db:migrate] ${message}`);
  process.exitCode = 1;
});
