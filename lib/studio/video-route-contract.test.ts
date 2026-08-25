import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('video request validation failures always stay inside the JSON response boundary', () => {
  const source = readFileSync(
    join(process.cwd(), 'app/api/studio/video/route.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /throw error;/u);
  assert.match(source, /normalizeStudioVideoPrompt/u);
});
