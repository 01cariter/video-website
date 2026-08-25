import assert from 'node:assert/strict';
import test from 'node:test';
import { requestSocialAction } from './social-action';

test('returns data for successful social actions', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => Response.json({ liked: true });
  assert.deepEqual(await requestSocialAction('/like'), { liked: true });
});

test('opens auth for 401 and throws for other failures', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let unauthorized = false;
  globalThis.fetch = async () => new Response(null, { status: 401 });
  assert.equal(
    await requestSocialAction('/like', {
      onUnauthorized: () => {
        unauthorized = true;
      },
    }),
    null,
  );
  assert.equal(unauthorized, true);

  globalThis.fetch = async () => new Response(null, { status: 500 });
  await assert.rejects(() => requestSocialAction('/like'));
});
