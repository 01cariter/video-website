import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deleteStudioProjectSynced,
  getStudioProjectSynced,
  listStudioProjectsSynced,
  saveStudioProjectSynced,
} from './client-store';
import {
  createBlankNode,
  createStudioProjectDraft,
  getStudioProject,
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

test('a local-only project is queued for cloud recovery while listing', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  const savedIds: string[] = [];

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  const local = saveStudioProject(createStudioProjectDraft({ blank: true }));
  globalThis.fetch = async (input, init) => {
    if (!init?.method) return Response.json({ projects: [] });
    savedIds.push(decodeURIComponent(String(input).split('/').pop() || ''));
    const body = JSON.parse(String(init.body)) as { project: unknown };
    return Response.json({ project: body.project });
  };

  try {
    const projects = await listStudioProjectsSynced();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.ok(projects.some((project) => project.id === local.id));
    assert.ok(savedIds.includes(local.id));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('a cloud list failure is surfaced without hiding local projects', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  let syncError = '';

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  const local = saveStudioProject(
    createStudioProjectDraft({ blank: true }),
    'user-1',
  );
  globalThis.fetch = async () => Response.json(
    { error: 'Temporary database failure.' },
    { status: 503 },
  );

  try {
    const projects = await listStudioProjectsSynced('user-1', {
      onRemoteFailure: (error) => {
        syncError = error.message;
      },
    });
    assert.ok(projects.some((project) => project.id === local.id));
    assert.match(syncError, /database failure/i);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('a cached project missing from the cloud is queued for recovery when opened', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  let saveCount = 0;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  const local = saveStudioProject(createStudioProjectDraft({ blank: true }));
  globalThis.fetch = async (_input, init) => {
    if (!init?.method) return new Response(null, { status: 404 });
    saveCount += 1;
    const body = JSON.parse(String(init.body)) as { project: unknown };
    return Response.json({ project: body.project });
  };

  try {
    assert.equal((await getStudioProjectSynced(local.id))?.id, local.id);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(saveCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('a cloud project failure is not misreported as a missing canvas on a new device', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  globalThis.fetch = async () => Response.json(
    { error: 'Temporary database failure.' },
    { status: 503 },
  );

  try {
    await assert.rejects(
      () =>
        getStudioProjectSynced('p_cloud-only', 'user-1', {
          throwOnRemoteFailure: true,
        }),
      /database failure/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('a failed cloud delete preserves the recoverable local project', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  const local = saveStudioProject(createStudioProjectDraft({ blank: true }));
  globalThis.fetch = async () => Response.json(
    { error: 'Temporary database failure.' },
    { status: 503 },
  );

  try {
    await assert.rejects(() => deleteStudioProjectSynced(local.id));
    assert.equal(getStudioProject(local.id)?.id, local.id);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('workspace saves can surface a remote failure while retaining local data', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  const project = createStudioProjectDraft({ blank: true });
  globalThis.fetch = async () => Response.json(
    { error: 'Temporary database failure.' },
    { status: 503 },
  );

  try {
    await assert.rejects(() =>
      saveStudioProjectSynced(project, { throwOnRemoteFailure: true }),
    );
    assert.equal(getStudioProject(project.id)?.id, project.id);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('same-revision cross-device conflicts rebase and retry local edits', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  const writes: Array<{ revision: number; nodes: Array<{ data: { text?: string } }> }> = [];
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
  const local = {
    ...draft,
    nodes: [
      createBlankNode('text', { x: 0, y: 0 }, { text: 'Local edit' }),
    ],
  };
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      project: { revision: number; nodes: Array<{ data: { text?: string } }> };
    };
    writes.push(body.project);
    if (writes.length === 1) {
      return Response.json({
        project: {
          ...body.project,
          nodes: [
            {
              ...body.project.nodes[0],
              data: { ...body.project.nodes[0].data, text: 'Remote edit' },
            },
          ],
        },
      });
    }
    return Response.json({ project: body.project });
  };

  try {
    const saved = await saveStudioProjectSynced(local);
    assert.equal(writes.length, 2);
    assert.ok(writes[1].revision > writes[0].revision);
    assert.equal(saved.nodes[0].data.text, 'Local edit');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
