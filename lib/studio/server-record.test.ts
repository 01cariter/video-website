import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudioProjectDraft } from './store';
import { decodeStudioJsonb, studioProjectJsonFields } from './server-record';

test('Studio JSONB fields are passed to Postgres as structured JSON', () => {
  const project = createStudioProjectDraft({ blank: true });
  const fields = studioProjectJsonFields(project);

  assert.equal(typeof fields.document, 'object');
  assert.ok(Array.isArray(fields.messages));
});

test('legacy JSONB scalar strings remain readable during migration', () => {
  const document = decodeStudioJsonb(
    JSON.stringify({ nodes: [{ id: 'n_1' }], revision: 7 }),
    {},
  );
  const messages = decodeStudioJsonb(JSON.stringify([{ id: 'm_1' }]), []);

  assert.deepEqual(document, { nodes: [{ id: 'n_1' }], revision: 7 });
  assert.deepEqual(messages, [{ id: 'm_1' }]);
});

test('pending homepage generation intent survives the server round trip', () => {
  const project = createStudioProjectDraft({
    pendingGeneration: {
      kind: 'image',
      prompt: 'A product portrait',
      data: { modelId: 'spacexai/grok-imagine-image-2.0', aspect: '4:5' },
    },
  });
  const fields = studioProjectJsonFields(project);

  assert.deepEqual(fields.document.pendingGeneration, project.pendingGeneration);
});
