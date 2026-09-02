-- Collections — a creator's own ordered series, the way a Douyin 合集 works.
-- A post belongs to at most one collection; a collection belongs to one
-- creator. Episode order is the order the posts were published, so there is no
-- position column to keep in sync and no reordering UI to build yet.

create table if not exists public.collections (
  id          serial primary key,
  owner_id    text not null references public.profiles(user_id) on delete cascade,
  title       text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint collections_title_not_blank check (length(btrim(title)) > 0)
);

create index if not exists idx_collections_owner
  on public.collections (owner_id, created_at desc);

-- A post keeps its place in the feed when its collection is deleted.
alter table public.videos
  add column if not exists collection_id integer
  references public.collections(id) on delete set null;

create index if not exists idx_videos_collection
  on public.videos (collection_id, created_at, id);

alter table public.collections enable row level security;

drop policy if exists "collections_public_read" on public.collections;
create policy "collections_public_read"
  on public.collections for select
  to anon, authenticated
  using (true);

drop policy if exists "collections_insert_own" on public.collections;
create policy "collections_insert_own"
  on public.collections for insert
  to authenticated
  with check (owner_id = (select auth.uid()::text));

drop policy if exists "collections_update_own" on public.collections;
create policy "collections_update_own"
  on public.collections for update
  to authenticated
  using (owner_id = (select auth.uid()::text))
  with check (owner_id = (select auth.uid()::text));

drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_delete_own"
  on public.collections for delete
  to authenticated
  using (owner_id = (select auth.uid()::text));

grant select on public.collections to anon, authenticated;
grant insert, update, delete on public.collections to authenticated;
grant usage, select on sequence public.collections_id_seq to authenticated;
