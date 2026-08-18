export const CUSTOM_CREDIT_PACKAGE_ID = 'custom';
export const CUSTOM_CREDIT_MIN = 100;
export const CUSTOM_CREDIT_MAX = 50_000;
export const CUSTOM_CREDIT_STEP = 10;

export function isValidCustomCreditAmount(value: number) {
  return (
    Number.isInteger(value) &&
    value >= CUSTOM_CREDIT_MIN &&
    value <= CUSTOM_CREDIT_MAX
  );
}

export function customCreditPriceCents(credits: number) {
  const safeCredits = Math.min(
    CUSTOM_CREDIT_MAX,
    Math.max(CUSTOM_CREDIT_MIN, Math.round(credits)),
  );
  return Math.max(299, Math.ceil((safeCredits * 3) / 2));
}
