-- CreatorStudio persistence, metered AI credits and Stripe-ready billing.

create table if not exists public.studio_projects (
  id text primary key,
  owner_id text not null,
  title text not null default '未命名项目',
  document jsonb not null default '{"nodes":[],"viewport":{"x":72,"y":64,"zoom":1}}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  cover_urls text[] not null default '{}',
  pending_prompt text,
  agent_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_projects_owner_updated
  on public.studio_projects(owner_id, updated_at desc);

create table if not exists public.credit_accounts (
  user_id text primary key,
  balance bigint not null default 0 check (balance >= 0),
  lifetime_earned bigint not null default 0 check (lifetime_earned >= 0),
  lifetime_spent bigint not null default 0 check (lifetime_spent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.credit_accounts(user_id) on delete cascade,
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  entry_type text not null,
  reference_id text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists idx_credit_ledger_user_created
  on public.credit_ledger(user_id, created_at desc);

create table if not exists public.credit_packages (
  id text primary key,
  name text not null,
  description text,
  credits integer not null check (credits > 0),
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'usd',
  stripe_price_id text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.credit_packages (
  id, name, description, credits, price_cents, currency, sort_order
)
values
  ('starter', 'Starter', '适合偶尔生成图片与文案', 300, 500, 'usd', 10),
  ('creator', 'Creator', '适合持续进行视觉创作', 800, 1000, 'usd', 20),
  ('studio', 'Studio', '适合高频图片与视频生成', 1800, 2000, 'usd', 30)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  credits = excluded.credits,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.credit_orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  package_id text not null references public.credit_packages(id),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'refunded', 'failed')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  credits integer not null check (credits > 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_credit_orders_user_created
  on public.credit_orders(user_id, created_at desc);

create table if not exists public.billing_events (
  provider_event_id text primary key,
  provider text not null default 'stripe',
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.ai_generation_requests (
  user_id text not null,
  request_id text not null,
  kind text not null check (kind in ('agent', 'text', 'image', 'video')),
  project_id text,
  node_id text,
  cost integer not null check (cost > 0),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, request_id)
);

create index if not exists idx_ai_generation_requests_project
  on public.ai_generation_requests(user_id, project_id, created_at desc);

create or replace function public.apply_credit_delta(
  p_user_id text,
  p_amount bigint,
  p_entry_type text,
  p_idempotency_key text,
  p_reference_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(balance bigint, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current bigint;
  v_next bigint;
  v_existing bigint;
begin
  if p_user_id is null or btrim(p_user_id) = '' then
    raise exception 'INVALID_USER_ID';
  end if;
  if p_amount = 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id || ':' || p_idempotency_key, 0)
  );

  insert into public.credit_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select l.balance_after
    into v_existing
  from public.credit_ledger l
  where l.user_id = p_user_id
    and l.idempotency_key = p_idempotency_key;

  if found then
    return query select v_existing, false;
    return;
  end if;

  select a.balance
    into v_current
  from public.credit_accounts a
  where a.user_id = p_user_id
  for update;

  v_next := v_current + p_amount;
  if v_next < 0 then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  update public.credit_accounts
  set
    balance = v_next,
    lifetime_earned = lifetime_earned + greatest(p_amount, 0),
    lifetime_spent = lifetime_spent + greatest(-p_amount, 0),
    updated_at = now()
  where user_id = p_user_id;

  insert into public.credit_ledger(
    user_id,
    amount,
    balance_after,
    entry_type,
    reference_id,
    idempotency_key,
    metadata
  )
  values (
    p_user_id,
    p_amount,
    v_next,
    p_entry_type,
    p_reference_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query select v_next, true;
end;
$$;

create or replace function public.fulfill_credit_order(
  p_order_id uuid,
  p_provider_event_id text,
  p_payment_intent_id text default null
)
returns table(balance bigint, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.credit_orders%rowtype;
  v_balance bigint;
  v_applied boolean;
begin
  select *
    into v_order
  from public.credit_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status = 'paid' then
    select a.balance into v_balance
    from public.credit_accounts a
    where a.user_id = v_order.user_id;
    return query select coalesce(v_balance, 0), false;
    return;
  end if;

  if v_order.status <> 'pending' then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;

  select r.balance, r.applied
    into v_balance, v_applied
  from public.apply_credit_delta(
    v_order.user_id,
    v_order.credits,
    'top_up',
    'stripe-order:' || v_order.id::text,
    v_order.id::text,
    jsonb_build_object(
      'packageId', v_order.package_id,
      'providerEventId', p_provider_event_id
    )
  ) r;

  update public.credit_orders
  set
    status = 'paid',
    stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
    paid_at = now(),
    updated_at = now()
  where id = v_order.id;

  return query select v_balance, v_applied;
end;
$$;

create or replace function public.begin_ai_generation_request(
  p_user_id text,
  p_request_id text,
  p_kind text,
  p_cost integer,
  p_project_id text default null,
  p_node_id text default null
)
returns table(
  request_status text,
  balance bigint,
  result jsonb,
  accepted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.ai_generation_requests%rowtype;
  v_balance bigint;
  v_applied boolean;
begin
  if p_request_id is null or btrim(p_request_id) = '' then
    raise exception 'INVALID_REQUEST_ID';
  end if;
  if p_cost <= 0 then
    raise exception 'INVALID_CREDIT_COST';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id || ':' || p_request_id, 0)
  );

  select *
    into v_request
  from public.ai_generation_requests
  where user_id = p_user_id and request_id = p_request_id;

  if found then
    select a.balance into v_balance
    from public.credit_accounts a
    where a.user_id = p_user_id;
    return query
      select v_request.status, coalesce(v_balance, 0), v_request.result, false;
    return;
  end if;

  insert into public.ai_generation_requests(
    user_id, request_id, kind, project_id, node_id, cost
  )
  values (
    p_user_id, p_request_id, p_kind, p_project_id, p_node_id, p_cost
  );

  select r.balance, r.applied
    into v_balance, v_applied
  from public.apply_credit_delta(
    p_user_id,
    -p_cost,
    'ai_' || p_kind,
    'ai-charge:' || p_request_id,
    p_request_id,
    jsonb_build_object(
      'kind', p_kind,
      'projectId', p_project_id,
      'nodeId', p_node_id
    )
  ) r;

  return query select 'pending'::text, v_balance, null::jsonb, true;
end;
$$;

create or replace function public.complete_ai_generation_request(
  p_user_id text,
  p_request_id text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_generation_requests
  set
    status = 'completed',
    result = coalesce(p_result, '{}'::jsonb),
    error = null,
    completed_at = now()
  where user_id = p_user_id
    and request_id = p_request_id
    and status = 'pending';
end;
$$;

create or replace function public.fail_ai_generation_request(
  p_user_id text,
  p_request_id text,
  p_error text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.ai_generation_requests%rowtype;
  v_balance bigint;
  v_applied boolean;
begin
  select *
    into v_request
  from public.ai_generation_requests
  where user_id = p_user_id and request_id = p_request_id
  for update;

  if not found then
    return null;
  end if;

  if v_request.status = 'pending' then
    select r.balance, r.applied
      into v_balance, v_applied
    from public.apply_credit_delta(
      p_user_id,
      v_request.cost,
      'ai_refund',
      'ai-refund:' || p_request_id,
      p_request_id,
      jsonb_build_object('kind', v_request.kind)
    ) r;

    update public.ai_generation_requests
    set
      status = 'failed',
      error = left(coalesce(p_error, 'Generation failed'), 1000),
      completed_at = now()
    where user_id = p_user_id and request_id = p_request_id;
  else
    select a.balance into v_balance
    from public.credit_accounts a
    where a.user_id = p_user_id;
  end if;

  return coalesce(v_balance, 0);
end;
$$;

create or replace function public.refund_stale_ai_generation_requests(
  p_user_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.ai_generation_requests%rowtype;
  v_balance bigint;
  v_applied boolean;
  v_count integer := 0;
begin
  for v_request in
    select *
    from public.ai_generation_requests
    where user_id = p_user_id
      and status = 'pending'
      and created_at < now() - interval '30 minutes'
    for update skip locked
  loop
    select r.balance, r.applied
      into v_balance, v_applied
    from public.apply_credit_delta(
      p_user_id,
      v_request.cost,
      'ai_refund',
      'ai-refund:' || v_request.request_id,
      v_request.request_id,
      jsonb_build_object(
        'kind', v_request.kind,
        'reason', 'stale_request'
      )
    ) r;

    update public.ai_generation_requests
    set
      status = 'failed',
      error = 'Request timed out before completion',
      completed_at = now()
    where user_id = p_user_id
      and request_id = v_request.request_id
      and status = 'pending';

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.apply_credit_delta(text, bigint, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.fulfill_credit_order(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.begin_ai_generation_request(text, text, text, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_ai_generation_request(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_ai_generation_request(text, text, text)
  from public, anon, authenticated;
revoke all on function public.refund_stale_ai_generation_requests(text)
  from public, anon, authenticated;

alter table public.studio_projects enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_packages enable row level security;
alter table public.credit_orders enable row level security;
alter table public.billing_events enable row level security;
alter table public.ai_generation_requests enable row level security;

drop policy if exists "studio_projects_own_all" on public.studio_projects;
create policy "studio_projects_own_all"
  on public.studio_projects
  for all
  to authenticated
  using (owner_id = (select auth.uid()::text))
  with check (owner_id = (select auth.uid()::text));

drop policy if exists "credit_accounts_read_own" on public.credit_accounts;
create policy "credit_accounts_read_own"
  on public.credit_accounts for select to authenticated
  using (user_id = (select auth.uid()::text));

drop policy if exists "credit_ledger_read_own" on public.credit_ledger;
create policy "credit_ledger_read_own"
  on public.credit_ledger for select to authenticated
  using (user_id = (select auth.uid()::text));

drop policy if exists "credit_packages_public_read" on public.credit_packages;
create policy "credit_packages_public_read"
  on public.credit_packages for select to anon, authenticated
  using (active);

drop policy if exists "credit_orders_read_own" on public.credit_orders;
create policy "credit_orders_read_own"
  on public.credit_orders for select to authenticated
  using (user_id = (select auth.uid()::text));

drop policy if exists "ai_requests_read_own" on public.ai_generation_requests;
create policy "ai_requests_read_own"
  on public.ai_generation_requests for select to authenticated
  using (user_id = (select auth.uid()::text));

grant select, insert, update, delete on public.studio_projects to authenticated;
grant select on public.credit_accounts, public.credit_ledger, public.credit_orders,
  public.ai_generation_requests to authenticated;
grant select on public.credit_packages to anon, authenticated;

revoke insert, update, delete on public.credit_accounts, public.credit_ledger,
  public.credit_packages, public.credit_orders, public.billing_events,
  public.ai_generation_requests from anon, authenticated;
