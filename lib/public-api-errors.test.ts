import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('public API error responses do not expose internal exception details', () => {
  const files = [
    'app/api/media/route.ts',
    'app/api/videos/route.ts',
    'app/api/videos/[id]/comments/route.ts',
    'app/api/videos/[id]/save/route.ts',
    'app/api/videos/[id]/like/route.ts',
    'app/api/videos/[id]/view/route.ts',
    'app/api/authors/[id]/follow/route.ts',
  ];

  for (const file of files) {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    assert.doesNotMatch(
      source,
      /return NextResponse\.json\(\s*\{[^{}]*\bdetail\b[^{}]*\}/su,
      `${file} must log internal details without returning them`,
    );
  }
});
