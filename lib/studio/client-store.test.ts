import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getStudioProjectSynced,
  saveStudioProjectSynced,
} from './client-store';
import {
  createBlankNode,
  createStudioProjectDraft,
  saveStudioProject,
} from './store';

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

test('legacy empty remote data cannot overwrite a populated local canvas', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  let recoveredProject: { revision: number; nodes: unknown[] } | undefined;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });

  const draft = createStudioProjectDraft({ blank: true });
  const local = saveStudioProject({
    ...draft,
    nodes: [createBlankNode('text', { x: 0, y: 0 }, { text: 'Recovered' })],
  });
  const remote = {
    ...draft,
    revision: 38,
    persistenceVersion: undefined,
    nodes: [],
    messages: [],
  };
  globalThis.fetch = async (_input, init) => {
    if (!init?.method) return Response.json({ project: remote });
    const body = JSON.parse(String(init.body)) as {
      project: { revision: number; nodes: unknown[] };
    };
    recoveredProject = body.project;
    return Response.json({ project: body.project });
  };

  try {
    const opened = await getStudioProjectSynced(local.id);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(opened?.nodes.length, 1);
    assert.equal(recoveredProject?.nodes.length, 1);
    assert.ok((recoveredProject?.revision ?? 0) > remote.revision);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
