import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CUSTOM_CREDIT_MAX,
  CUSTOM_CREDIT_MIN,
  FALLBACK_CREDIT_LADDER,
  customCreditPriceCents,
} from './packages';

test('the slider agrees with every pack at that pack’s own size', () => {
  for (const stop of FALLBACK_CREDIT_LADDER) {
    assert.equal(customCreditPriceCents(stop.credits), stop.price_cents);
  }
});

// The bug this replaces: a fixed $0.02 slope survived a re-price of the packs,
// so 5,000 credits cost $100.99 on the slider and $69.99 on the button beside it.
test('the slider never quotes above a pack the reader could click instead', () => {
  for (const stop of FALLBACK_CREDIT_LADDER) {
    for (const credits of [stop.credits - 50, stop.credits, stop.credits]) {
      if (credits < CUSTOM_CREDIT_MIN) continue;
      assert.ok(
        customCreditPriceCents(credits) <= stop.price_cents,
        `${credits} credits should not cost more than the ${stop.credits} pack`,
      );
    }
  }
});

test('price rises with volume while the rate per credit falls', () => {
  const sizes = [100, 500, 1_000, 2_500, 5_000, 20_000, CUSTOM_CREDIT_MAX];
  let lastPrice = 0;
  let lastRate = Number.POSITIVE_INFINITY;
  for (const credits of sizes) {
    const price = customCreditPriceCents(credits);
    assert.ok(price > lastPrice, `${credits} should cost more than the step below`);
    const rate = price / credits;
    assert.ok(rate <= lastRate + 1e-9, `${credits} should not cost more per credit`);
    lastPrice = price;
    lastRate = rate;
  }
});

test('extends past the largest pack at that pack’s marginal rate', () => {
  // 1,000 → 5,000 runs at 1.3c per credit; 10,000 continues on the same slope.
  assert.equal(customCreditPriceCents(10_000), 6_999 + 5_000 * 1.3);
});

test('prices off the live packs when they are supplied', () => {
  const live = [
    { credits: 100, price_cents: 199 },
    { credits: 1_000, price_cents: 999 },
  ];
  assert.equal(customCreditPriceCents(100, live), 199);
  assert.equal(customCreditPriceCents(1_000, live), 999);
  assert.equal(customCreditPriceCents(550, live), 599);
});

test('falls back to the seeded ladder when the live rows are unusable', () => {
  assert.equal(customCreditPriceCents(1_000, []), 1_799);
  assert.equal(customCreditPriceCents(1_000, [{ credits: 100, price_cents: 299 }]), 1_799);
});

test('clamps untrusted amounts to the supported range', () => {
  assert.equal(customCreditPriceCents(1), 299);
  assert.equal(customCreditPriceCents(100_000), customCreditPriceCents(CUSTOM_CREDIT_MAX));
});
