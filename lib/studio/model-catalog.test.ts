import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STUDIO_MODEL_OPTIONS,
  STUDIO_MODEL_SPECS,
  isStudioModelAvailable,
  modelSpecFor,
  resolveStudioModel,
} from './model-catalog';
import { normalizeStudioRuntimeConfig } from './pricing';

test('every selectable model has a matching parameter contract', () => {
  for (const [kind, models] of Object.entries(STUDIO_MODEL_OPTIONS)) {
    for (const model of models) {
      const spec = STUDIO_MODEL_SPECS[model.id];
      assert.ok(spec, `${model.id} is missing a spec`);
      assert.equal(spec.kind, kind);
      assert.equal(spec.id, model.id);
      for (const field of spec.fields) {
        assert.notEqual(
          spec.defaults[field.key],
          undefined,
          `${model.id}.${field.key} is missing a default`,
        );
      }
    }
  }
});

test('model policy disables choices and selects an enabled fallback', () => {
  const runtime = normalizeStudioRuntimeConfig({
    modelPolicy: {
      'xai/grok-imagine-image-2.0': { enabled: false },
    },
  });
  const grok = STUDIO_MODEL_OPTIONS.image[0];
  assert.equal(isStudioModelAvailable(grok, runtime), false);
  assert.equal(
    resolveStudioModel('image', grok.id, runtime).id,
    'bytedance/seedream-5.0-pro',
  );
  assert.equal(
    modelSpecFor('image', grok.id, runtime).id,
    'bytedance/seedream-5.0-pro',
  );
});
