import 'server-only';

import postgres from 'postgres';
import { getPostgresUrl } from './supabase/env';

const globalForDb = globalThis;

function createSqlClient() {
  const url = getPostgresUrl();
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(url);

  return postgres(url, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: isLocal ? false : 'require',
  });
}

function getSqlClient() {
  globalForDb.__snackdSql ??= createSqlClient();
  return globalForDb.__snackdSql;
}

export function sql(strings, ...values) {
  return getSqlClient()(strings, ...values);
}

sql.unsafe = (...args) => getSqlClient().unsafe(...args);
