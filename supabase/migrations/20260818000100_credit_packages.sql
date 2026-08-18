-- Commercial one-time credit top-ups. Existing orders keep their historical
-- package references; old packages are only hidden, never deleted.

insert into public.credit_packages (
  id,
  name,
  description,
  credits,
  price_cents,
  currency,
  stripe_price_id,
  active,
  sort_order
)
values
  (
    'credits-10',
    'Light',
    'A low-cost way to try Agent and text generation',
    10,
    99,
    'usd',
    null,
    true,
    10
  ),
  (
    'credits-100',
    'Start',
    'For light image generation and everyday creation',
    100,
    299,
    'usd',
    null,
    true,
    20
  ),
  (
    'credits-1000',
    'Create',
    'For regular image and video generation',
    1000,
    1499,
    'usd',
    null,
    true,
    30
  ),
  (
    'credits-5000',
    'Studio',
    'For high-volume creation and team projects',
    5000,
    5999,
    'usd',
    null,
    true,
    40
  ),
  (
    'custom',
    'Custom',
    'Buy between 100 and 50,000 credits as needed',
    100,
    299,
    'usd',
    null,
    true,
    50
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  credits = excluded.credits,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  stripe_price_id = null,
  active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.credit_packages
set active = false, updated_at = now()
where id not in (
  'credits-10',
  'credits-100',
  'credits-1000',
  'credits-5000',
  'custom'
);
