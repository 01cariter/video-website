import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStudioGenerationResponse } from './generation-response';

test('turns a plain-text Vercel timeout into an actionable video error', async () => {
  const response = new Response('An error occurred with your deployment', {
    status: 504,
    headers: { 'content-type': 'text/plain' },
  });

  await assert.rejects(
    parseStudioGenerationResponse(response, 'video'),
    /Video generation timed out before the provider finished/,
  );
});

test('preserves structured API errors without leaking JSON parse failures', async () => {
  const response = Response.json(
    { error: 'This video model is currently unavailable.' },
    { status: 503 },
  );

  await assert.rejects(
    parseStudioGenerationResponse(response, 'video'),
    /This video model is currently unavailable/,
  );
});

test('returns a valid generation payload', async () => {
  const response = Response.json({
    url: 'https://cdn.example.com/video.mp4',
    balance: 120,
  });

  assert.deepEqual(await parseStudioGenerationResponse(response, 'video'), {
    url: 'https://cdn.example.com/video.mp4',
    balance: 120,
  });
});

test('accepts an idempotent processing receipt for generation recovery', async () => {
  const response = Response.json(
    { status: 'processing', retryAfterMs: 5_000, balance: 120 },
    { status: 202 },
  );

  assert.deepEqual(await parseStudioGenerationResponse(response, 'video'), {
    status: 'processing',
    retryAfterMs: 5_000,
    balance: 120,
  });
});
