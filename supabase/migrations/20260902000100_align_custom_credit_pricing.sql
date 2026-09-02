-- The custom slider used to be priced from a hardcoded $2.99 + $0.02/credit
-- slope. When 20260820000100 re-priced the packs the slope stayed behind, so
-- the slider quoted $100.99 for the 5,000 credits the Studio pack sold for
-- $69.99 — on the same screen, under the same toggle. Pricing now interpolates
-- the live pack ladder, so this row only needs its description to stop
-- advertising the old slope.

update public.credit_packages
set
  description = 'Any amount from 100 to 50,000 credits, priced on the same volume curve as the packs',
  updated_at = now()
where id = 'custom';
