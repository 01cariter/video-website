import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('recording a view does not invalidate the entire public feed cache', () => {
  const source = readFileSync(join(process.cwd(), 'lib/videos.ts'), 'utf8');
  const body = source.match(
    /export async function recordVideoView[\s\S]*?\n\}\n\n\/\/ Likes/u,
  )?.[0];

  assert.ok(body, 'recordVideoView source should be discoverable');
  assert.doesNotMatch(body, /revalidateTag/u);
});
