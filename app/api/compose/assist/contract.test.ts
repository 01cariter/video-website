import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boundedComposeUsage,
  buildComposePrompt,
  composeCopySchema,
  gatewayCostUsdMicros,
  normalizeComposeSource,
} from './contract';

test('normalizes untrusted compose context before quoting or generation', () => {
  const source = normalizeComposeSource({
    title: `  ${'t'.repeat(160)}  `,
    body: `  ${'b'.repeat(3_000)}  `,
    imageCount: 100,
    videoCount: -4,
  });

  assert.equal(source.title.length, 120);
  assert.equal(source.body.length, 2_400);
  assert.equal(source.imageCount, 20);
  assert.equal(source.videoCount, 0);
});

test('prompt preserves the supplied creator context and media summary', () => {
  const prompt = buildComposePrompt(
    normalizeComposeSource({
      title: '雨后的城市',
      body: '保留真实的创作过程。',
      imageCount: 2,
      videoCount: 1,
    }),
  );

  assert.match(prompt, /Keep the source language/);
  assert.match(prompt, /2 image\(s\) and 1 video\(s\)/);
  assert.match(prompt, /雨后的城市/);
  assert.match(prompt, /保留真实的创作过程/);
});

test('schema and settlement stay inside the authorized bounds', () => {
  assert.equal(
    composeCopySchema.safeParse({ title: 'Title', body: '' }).success,
    false,
  );
  assert.equal(
    composeCopySchema.safeParse({ title: '', body: 'Body' }).success,
    false,
  );
  assert.equal(boundedComposeUsage(undefined, 768), 768);
  assert.equal(boundedComposeUsage(999, 768), 768);
  assert.equal(boundedComposeUsage(-2, 768), 0);
});

test('reads the exact AI Gateway cost without trusting malformed metadata', () => {
  assert.equal(
    gatewayCostUsdMicros({ gateway: { cost: '0.0000672' } }),
    68,
  );
  assert.equal(gatewayCostUsdMicros({ gateway: { cost: 0.0125 } }), 12_500);
  assert.equal(gatewayCostUsdMicros({ gateway: { cost: '-1' } }), undefined);
  assert.equal(gatewayCostUsdMicros({ gateway: {} }), undefined);
});
