import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeStudioTextRequest,
  StudioTextValidationError,
} from './text-generation';

test('normalizes a valid Studio text request at the untrusted JSON boundary', () => {
  assert.deepEqual(
    normalizeStudioTextRequest({
      prompt: '  Write a launch caption  ',
      current: '  Draft  ',
      requestId: ' request-1 ',
      projectId: ' project-1 ',
      nodeId: ' node-1 ',
      modelId: 'openai/gpt-5.4',
      reasoningEffort: 'medium',
      expectedCredits: 12,
    }),
    {
      prompt: 'Write a launch caption',
      current: 'Draft',
      requestId: 'request-1',
      projectId: 'project-1',
      nodeId: 'node-1',
      modelId: 'openai/gpt-5.4',
      reasoningEffort: 'medium',
      expectedCredits: 12,
    },
  );
});

test('rejects malformed Studio text fields instead of throwing outside the JSON response boundary', () => {
  for (const value of [
    null,
    [],
    { prompt: 42, requestId: 'request-1' },
    { prompt: 'Write', current: {}, requestId: 'request-1' },
    { prompt: 'Write', requestId: 42 },
    { prompt: 'Write', requestId: 'request-1', projectId: 'x'.repeat(161) },
  ]) {
    assert.throws(
      () => normalizeStudioTextRequest(value),
      StudioTextValidationError,
    );
  }
});

test('bounds Studio text content and identifiers', () => {
  assert.throws(
    () =>
      normalizeStudioTextRequest({
        prompt: 'x'.repeat(20_001),
        requestId: 'request-1',
      }),
    /too long/i,
  );
  assert.throws(
    () =>
      normalizeStudioTextRequest({
        prompt: 'Write',
        requestId: 'x'.repeat(161),
      }),
    /identifier/i,
  );
});
