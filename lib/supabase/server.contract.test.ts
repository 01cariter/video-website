import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('server auth boundary', () => {
  it('verifies cookie-backed users instead of trusting a decoded session', async () => {
    const source = await readFile(
      new URL('./server.ts', import.meta.url),
      'utf8',
    );

    assert.match(source, /supabase\.auth\.getUser\(\)/);
    assert.doesNotMatch(source, /supabase\.auth\.getSession\(\)/);
    assert.match(source, /getVerifiedAuthUser = getAuthUser/);
  });
});
