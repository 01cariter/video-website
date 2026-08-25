import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('the media inventory endpoint only lists the signed-in owner files', () => {
  const route = readFileSync(
    join(process.cwd(), 'app/api/media/route.ts'),
    'utf8',
  );
  const media = readFileSync(join(process.cwd(), 'lib/media.ts'), 'utf8');

  assert.doesNotMatch(route, /let ownerId: string \| null = null/u);
  assert.match(route, /listMedia\(\{ ownerId: user\.id \}\)/u);
  assert.doesNotMatch(media, /ownerId\s*=\s*null/u);
});
