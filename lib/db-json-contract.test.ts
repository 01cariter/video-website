import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('database JSONB values are passed as structured parameters', () => {
  const files = [
    'lib/credits/server.ts',
    'app/api/billing/webhooks/stripe/route.ts',
  ];

  for (const file of files) {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    assert.equal(
      source.includes('JSON.stringify('),
      false,
      `${file} must use sqlJson instead of stringifying JSONB values`,
    );
  }
});
