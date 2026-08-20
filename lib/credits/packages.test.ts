import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CUSTOM_CREDIT_MAX,
  CUSTOM_CREDIT_MIN,
  customCreditPriceCents,
} from './packages';

test('custom credits start at $2.99 and add $0.02 per extra credit', () => {
  assert.equal(customCreditPriceCents(CUSTOM_CREDIT_MIN), 299);
  assert.equal(customCreditPriceCents(1_000), 2_099);
  assert.equal(customCreditPriceCents(CUSTOM_CREDIT_MAX), 100_099);
});

test('custom pricing clamps untrusted amounts to the supported range', () => {
  assert.equal(customCreditPriceCents(1), 299);
  assert.equal(customCreditPriceCents(100_000), 100_099);
});
