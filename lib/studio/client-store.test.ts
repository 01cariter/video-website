import assert from 'node:assert/strict';
import test from 'node:test';
import { saveStudioProjectSynced } from './client-store';
import { createStudioProjectDraft } from './store';

test('a final Studio save can use fetch keepalive during page exit', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  let requestInit: RequestInit | undefined;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  globalThis.fetch = async (_input, init) => {
    requestInit = init;
    const body = JSON.parse(String(init?.body)) as { project: unknown };
    return Response.json({ project: body.project });
  };

  try {
    await saveStudioProjectSynced(createStudioProjectDraft({ blank: true }), {
      keepalive: true,
    });
    assert.equal(requestInit?.keepalive, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
