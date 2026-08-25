import 'server-only';

import postgres from 'postgres';
import { getPostgresUrl } from './supabase/env';

type DbRow = Record<string, unknown>;
type SqlClient = ReturnType<typeof postgres>;

interface SqlQuery {
  <TRows extends readonly object[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<TRows>;
  unsafe<TRows extends readonly object[] = DbRow[]>(query: string, parameters?: readonly unknown[]): Promise<TRows>;
}

const globalForDb = globalThis as typeof globalThis & {
  __snackdSql?: SqlClient;
};

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

function json(value: unknown) {
  return getSqlClient().json(
    value as Parameters<SqlClient['json']>[0],
  );
}

const query = (<TRows extends readonly object[]>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => getSqlClient()(strings, ...(values as never[])) as unknown as Promise<TRows>) as SqlQuery;

query.unsafe = <TRows extends readonly object[] = DbRow[]>(
  statement: string,
  parameters: readonly unknown[] = [],
) => getSqlClient().unsafe(statement, parameters as never[]) as unknown as Promise<TRows>;

export { json as sqlJson, query as sql };
