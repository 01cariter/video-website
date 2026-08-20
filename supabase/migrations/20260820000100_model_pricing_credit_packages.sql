-- Reprice credit packs around the model-cost ledger introduced in the Studio.
-- One credit represents one cent of metered value; Studio model policies add a
-- minimum 1.25x cost multiplier (1.5x by default) before converting to credits.

update public.credit_packages
set
  name = 'Light',
  description = 'A low-cost way to try Agent and text generation',
  credits = 10,
  price_cents = 99,
  currency = 'usd',
  stripe_price_id = null,
  active = true,
  sort_order = 10,
  updated_at = now()
where id = 'credits-10';

update public.credit_packages
set
  name = 'Start',
  description = 'For a small image project and everyday creation',
  credits = 100,
  price_cents = 299,
  currency = 'usd',
  stripe_price_id = null,
  active = true,
  sort_order = 20,
  updated_at = now()
where id = 'credits-100';

update public.credit_packages
set
  name = 'Create',
  description = 'For regular image and video generation',
  credits = 1000,
  price_cents = 1799,
  currency = 'usd',
  stripe_price_id = null,
  active = true,
  sort_order = 30,
  updated_at = now()
where id = 'credits-1000';

update public.credit_packages
set
  name = 'Studio',
  description = 'For high-volume creation and team projects',
  credits = 5000,
  price_cents = 6999,
  currency = 'usd',
  stripe_price_id = null,
  active = true,
  sort_order = 40,
  updated_at = now()
where id = 'credits-5000';

update public.credit_packages
set
  name = 'Custom',
  description = '100 credits for $2.99, then $0.02 per additional credit',
  credits = 100,
  price_cents = 299,
  currency = 'usd',
  stripe_price_id = null,
  active = true,
  sort_order = 50,
  updated_at = now()
where id = 'custom';

-- Agent requests reserve a bounded multi-step budget, then refund the unused
-- portion from the provider's aggregated token usage. The advisory lock and
-- ledger idempotency key make completion safe to retry.
create or replace function public.complete_metered_ai_generation_request(
  p_user_id text,
  p_request_id text,
  p_result jsonb,
  p_actual_cost integer
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.ai_generation_requests%rowtype;
  v_balance bigint;
  v_refund integer;
  v_applied boolean;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id || ':' || p_request_id, 0)
  );

  select *
    into v_request
  from public.ai_generation_requests
  where user_id = p_user_id and request_id = p_request_id
  for update;

  if not found then
    return null;
  end if;

  if v_request.status = 'pending' then
    if p_actual_cost < 1 or p_actual_cost > v_request.cost then
      raise exception 'INVALID_ACTUAL_CREDIT_COST';
    end if;

    v_refund := v_request.cost - p_actual_cost;
    if v_refund > 0 then
      select r.balance, r.applied
        into v_balance, v_applied
      from public.apply_credit_delta(
        p_user_id,
        v_refund,
        'ai_refund',
        'ai-reconcile:' || p_request_id,
        p_request_id,
        jsonb_build_object(
          'kind', v_request.kind,
          'reason', 'unused_reserve',
          'reservedCredits', v_request.cost,
          'actualCredits', p_actual_cost
        )
      ) r;

      -- Reconciliation is a reversal of the original reservation, not newly
      -- earned credit. Keep lifetime totals at the net settled spend.
      update public.credit_accounts
      set
        lifetime_earned = greatest(0, lifetime_earned - v_refund),
        lifetime_spent = greatest(0, lifetime_spent - v_refund)
      where user_id = p_user_id;
    end if;

    update public.ai_generation_requests
    set
      status = 'completed',
      cost = p_actual_cost,
      result = coalesce(p_result, '{}'::jsonb),
      error = null,
      completed_at = now()
    where user_id = p_user_id
      and request_id = p_request_id
      and status = 'pending';
  end if;

  if v_balance is null then
    select a.balance into v_balance
    from public.credit_accounts a
    where a.user_id = p_user_id;
  end if;

  return coalesce(v_balance, 0);
end;
$$;

revoke all on function public.complete_metered_ai_generation_request(
  text, text, jsonb, integer
) from public, anon, authenticated;
