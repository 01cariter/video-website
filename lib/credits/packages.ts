export const CUSTOM_CREDIT_PACKAGE_ID = 'custom';
export const CUSTOM_CREDIT_MIN = 100;
export const CUSTOM_CREDIT_MAX = 50_000;
export const CUSTOM_CREDIT_STEP = 10;

export interface CreditLadderStop {
  credits: number;
  price_cents: number;
}

/**
 * Mirrors the packs seeded in `credit_packages`, and is only used when the live
 * rows cannot be read. The slider is priced off the real rows wherever they are
 * available, because a hardcoded slope drifting from the packs is exactly how
 * the slider ended up quoting more than the pack beside it.
 */
export const FALLBACK_CREDIT_LADDER: CreditLadderStop[] = [
  { credits: 100, price_cents: 299 },
  { credits: 1_000, price_cents: 1_799 },
  { credits: 5_000, price_cents: 6_999 },
];

export function isValidCustomCreditAmount(value: number) {
  return (
    Number.isInteger(value) &&
    value >= CUSTOM_CREDIT_MIN &&
    value <= CUSTOM_CREDIT_MAX
  );
}

function ladderStops(packages?: readonly CreditLadderStop[]) {
  const stops = (packages ?? [])
    .filter(
      (stop) =>
        Number.isFinite(stop.credits) &&
        Number.isFinite(stop.price_cents) &&
        stop.credits >= CUSTOM_CREDIT_MIN &&
        stop.price_cents > 0,
    )
    .map((stop) => ({
      credits: Math.round(stop.credits),
      price_cents: Math.round(stop.price_cents),
    }))
    .sort((first, second) => first.credits - second.credits);

  // Collapse duplicate sizes and keep the cheapest, so a stale row can never
  // pull the curve upwards.
  const unique: CreditLadderStop[] = [];
  for (const stop of stops) {
    const last = unique[unique.length - 1];
    if (last && last.credits === stop.credits) {
      if (stop.price_cents < last.price_cents) unique[unique.length - 1] = stop;
      continue;
    }
    unique.push(stop);
  }
  return unique.length >= 2 ? unique : FALLBACK_CREDIT_LADDER;
}

/**
 * Prices any amount on the same volume curve as the packs: linear between the
 * pack sizes, continuing at the last segment's marginal rate beyond the largest
 * pack. At a pack's own size it returns that pack's price exactly, so the
 * slider and the button beside it can never disagree.
 */
export function customCreditPriceCents(
  credits: number,
  packages?: readonly CreditLadderStop[],
) {
  const safeCredits = Math.min(
    CUSTOM_CREDIT_MAX,
    Math.max(CUSTOM_CREDIT_MIN, Math.round(credits)),
  );
  const stops = ladderStops(packages);

  const first = stops[0];
  if (safeCredits <= first.credits) return first.price_cents;

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const stop = stops[index];
    if (safeCredits <= stop.credits) {
      const marginal =
        (stop.price_cents - previous.price_cents) /
        (stop.credits - previous.credits);
      return Math.round(
        previous.price_cents + (safeCredits - previous.credits) * marginal,
      );
    }
  }

  const last = stops[stops.length - 1];
  const previous = stops[stops.length - 2];
  const marginal =
    (last.price_cents - previous.price_cents) /
    (last.credits - previous.credits);
  return Math.round(last.price_cents + (safeCredits - last.credits) * marginal);
}
