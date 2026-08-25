import assert from 'node:assert/strict';
import test from 'node:test';
import { runIdempotentWebhookEvent } from './webhook';

test('records a webhook only after domain processing succeeds', async () => {
  const calls: string[] = [];
  const result = await runIdempotentWebhookEvent({
    event: { id: 'evt_1' },
    eventId: 'evt_1',
    hasProcessed: async () => false,
    process: async () => {
      calls.push('process');
    },
    record: async () => {
      calls.push('record');
    },
  });

  assert.equal(result, 'processed');
  assert.deepEqual(calls, ['process', 'record']);
});

test('a failed webhook remains retryable and is never recorded as complete', async () => {
  let recorded = false;
  await assert.rejects(() =>
    runIdempotentWebhookEvent({
      event: { id: 'evt_2' },
      eventId: 'evt_2',
      hasProcessed: async () => false,
      process: async () => {
        throw new Error('temporary database failure');
      },
      record: async () => {
        recorded = true;
      },
    }),
  );
  assert.equal(recorded, false);
});

test('an already completed webhook skips duplicate domain work', async () => {
  let processed = false;
  const result = await runIdempotentWebhookEvent({
    event: { id: 'evt_3' },
    eventId: 'evt_3',
    hasProcessed: async () => true,
    process: async () => {
      processed = true;
    },
    record: async () => undefined,
  });

  assert.equal(result, 'duplicate');
  assert.equal(processed, false);
});
