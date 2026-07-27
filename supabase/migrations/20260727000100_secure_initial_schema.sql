-- Production-safe schema, access policies, storage configuration and counters.
-- Apply with `supabase db push` or paste this migration into the Supabase SQL editor.

create table if not exists public.profiles (
  user_id text primary key,
  handle text unique,
  display_name text,
  bio text,
  avatar_color text not null default '#3f7d92',
  avatar_media_id integer,
  level integer not null default 1,
  streak integer not null default 0,
  followers_count integer not null default 0,
  constraint profiles_nonnegative_counters check (
    level >= 1 and streak >= 0 and followers_count >= 0
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id serial primary key,
  kind text not null check (kind in ('image', 'video')),
  mime text not null default 'image/svg+xml',
  url text,
  data bytea,
  width integer,
  height integer,
  duration_seconds numeric,
  owner_id text,
  created_at timestamptz not null default now(),
  check (url is not null or data is not null)
);

create table if not exists public.videos (
  id serial primary key,
  title text not null,
  description text,
  category text not null check (category in ('study', 'play')),
  label text,
  size text not null default '',
  author_id text not null references public.profiles(user_id) on delete cascade,
  poster_media_id integer references public.media(id) on delete set null,
  video_media_id integer references public.media(id) on delete set null,
  duration text not null default '',
  likes_count integer not null default 0,
  saves_count integer not null default 0,
  comments_count integer not null default 0,
  views_count integer not null default 0,
  constraint videos_nonnegative_counters check (
    likes_count >= 0
    and saves_count >= 0
    and comments_count >= 0
    and views_count >= 0
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.video_likes (
  user_id text not null,
  video_id integer not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.video_saves (
  user_id text not null,
  video_id integer not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.follows (
  follower_id text not null,
  author_id text not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, author_id),
  check (follower_id <> author_id)
);

create table if not exists public.comments (
  id serial primary key,
  video_id integer not null references public.videos(id) on delete cascade,
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_handle on public.profiles(handle);
create index if not exists idx_media_owner on public.media(owner_id);
create index if not exists idx_media_kind on public.media(kind);
create index if not exists idx_videos_author on public.videos(author_id);
create index if not exists idx_videos_feed on public.videos(
  category,
  likes_count desc,
  saves_count desc,
  comments_count desc,
  views_count desc,
  created_at desc,
  id desc
);
create index if not exists idx_video_likes_user on public.video_likes(user_id);
create index if not exists idx_video_likes_video on public.video_likes(video_id);
create index if not exists idx_video_saves_user on public.video_saves(user_id);
create index if not exists idx_video_saves_video on public.video_saves(video_id);
create index if not exists idx_follows_author on public.follows(author_id);
create index if not exists idx_comments_video on public.comments(video_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.media enable row level security;
alter table public.videos enable row level security;
alter table public.video_likes enable row level security;
alter table public.video_saves enable row level security;
alter table public.follows enable row level security;
alter table public.comments enable row level security;

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (user_id = (select auth.uid()::text));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (user_id = (select auth.uid()::text))
  with check (user_id = (select auth.uid()::text));

drop policy if exists "media_public_read" on public.media;
create policy "media_public_read"
  on public.media for select
  to anon, authenticated
  using (true);

drop policy if exists "media_insert_own" on public.media;
create policy "media_insert_own"
  on public.media for insert
  to authenticated
  with check (owner_id = (select auth.uid()::text));

drop policy if exists "media_update_own" on public.media;
create policy "media_update_own"
  on public.media for update
  to authenticated
  using (owner_id = (select auth.uid()::text))
  with check (owner_id = (select auth.uid()::text));

drop policy if exists "media_delete_own" on public.media;
create policy "media_delete_own"
  on public.media for delete
  to authenticated
  using (owner_id = (select auth.uid()::text));

drop policy if exists "videos_public_read" on public.videos;
create policy "videos_public_read"
  on public.videos for select
  to anon, authenticated
  using (true);

drop policy if exists "videos_insert_own" on public.videos;
create policy "videos_insert_own"
  on public.videos for insert
  to authenticated
  with check (author_id = (select auth.uid()::text));

drop policy if exists "videos_update_own" on public.videos;
create policy "videos_update_own"
  on public.videos for update
  to authenticated
  using (author_id = (select auth.uid()::text))
  with check (author_id = (select auth.uid()::text));

drop policy if exists "videos_delete_own" on public.videos;
create policy "videos_delete_own"
  on public.videos for delete
  to authenticated
  using (author_id = (select auth.uid()::text));

drop policy if exists "video_likes_read_own" on public.video_likes;
create policy "video_likes_read_own"
  on public.video_likes for select
  to authenticated
  using (user_id = (select auth.uid()::text));

drop policy if exists "video_likes_insert_own" on public.video_likes;
create policy "video_likes_insert_own"
  on public.video_likes for insert
  to authenticated
  with check (user_id = (select auth.uid()::text));

drop policy if exists "video_likes_delete_own" on public.video_likes;
create policy "video_likes_delete_own"
  on public.video_likes for delete
  to authenticated
  using (user_id = (select auth.uid()::text));

drop policy if exists "video_saves_read_own" on public.video_saves;
create policy "video_saves_read_own"
  on public.video_saves for select
  to authenticated
  using (user_id = (select auth.uid()::text));

drop policy if exists "video_saves_insert_own" on public.video_saves;
create policy "video_saves_insert_own"
  on public.video_saves for insert
  to authenticated
  with check (user_id = (select auth.uid()::text));

drop policy if exists "video_saves_delete_own" on public.video_saves;
create policy "video_saves_delete_own"
  on public.video_saves for delete
  to authenticated
  using (user_id = (select auth.uid()::text));

drop policy if exists "follows_public_read" on public.follows;
create policy "follows_public_read"
  on public.follows for select
  to anon, authenticated
  using (true);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
  on public.follows for insert
  to authenticated
  with check (follower_id = (select auth.uid()::text));

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
  on public.follows for delete
  to authenticated
  using (follower_id = (select auth.uid()::text));

drop policy if exists "comments_public_read" on public.comments;
create policy "comments_public_read"
  on public.comments for select
  to anon, authenticated
  using (true);

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own"
  on public.comments for insert
  to authenticated
  with check (
    user_id = (select auth.uid()::text)
    and char_length(btrim(body)) between 1 and 1000
  );

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
  on public.comments for update
  to authenticated
  using (user_id = (select auth.uid()::text))
  with check (
    user_id = (select auth.uid()::text)
    and char_length(btrim(body)) between 1 and 1000
  );

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own"
  on public.comments for delete
  to authenticated
  using (user_id = (select auth.uid()::text));

grant select on public.profiles, public.media, public.videos, public.comments, public.follows
  to anon, authenticated;

revoke insert, update, delete on public.profiles, public.media, public.videos,
  public.video_likes, public.video_saves, public.follows, public.comments
  from authenticated;

grant insert (user_id, handle, display_name, bio, avatar_color, avatar_media_id)
  on public.profiles to authenticated;
grant update (handle, display_name, bio, avatar_color, avatar_media_id)
  on public.profiles to authenticated;

grant insert (kind, mime, url, data, width, height, duration_seconds, owner_id)
  on public.media to authenticated;
grant update (kind, mime, url, data, width, height, duration_seconds)
  on public.media to authenticated;
grant delete on public.media to authenticated;

grant insert (
  title, description, category, label, size, author_id,
  poster_media_id, video_media_id, duration
)
  on public.videos to authenticated;
grant update (
  title, description, category, label, size,
  poster_media_id, video_media_id, duration
)
  on public.videos to authenticated;
grant delete on public.videos to authenticated;

grant insert, delete on public.video_likes, public.video_saves, public.follows
  to authenticated;
grant insert, delete on public.comments to authenticated;
grant update (body) on public.comments
  to authenticated;
grant select on public.video_likes, public.video_saves to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_media_select_own" on storage.objects;
create policy "storage_media_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'media'
    and owner_id = (select auth.uid()::text)
  );

drop policy if exists "storage_media_insert_own_folder" on storage.objects;
create policy "storage_media_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "storage_media_update_own" on storage.objects;
create policy "storage_media_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media'
    and owner_id = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'media'
    and owner_id = (select auth.uid()::text)
  );

drop policy if exists "storage_media_delete_own" on storage.objects;
create policy "storage_media_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and owner_id = (select auth.uid()::text)
  );

create or replace function public.sync_video_counter()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'video_likes' then
      update public.videos set likes_count = likes_count + 1 where id = new.video_id;
    elsif tg_table_name = 'video_saves' then
      update public.videos set saves_count = saves_count + 1 where id = new.video_id;
    elsif tg_table_name = 'comments' then
      update public.videos set comments_count = comments_count + 1 where id = new.video_id;
    end if;
    return new;
  end if;

  if tg_table_name = 'video_likes' then
    update public.videos set likes_count = greatest(likes_count - 1, 0) where id = old.video_id;
  elsif tg_table_name = 'video_saves' then
    update public.videos set saves_count = greatest(saves_count - 1, 0) where id = old.video_id;
  elsif tg_table_name = 'comments' then
    update public.videos set comments_count = greatest(comments_count - 1, 0) where id = old.video_id;
  end if;
  return old;
end;
$$;

create or replace function public.sync_follow_counter()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set followers_count = followers_count + 1
    where user_id = new.author_id;
    return new;
  end if;

  update public.profiles
  set followers_count = greatest(followers_count - 1, 0)
  where user_id = old.author_id;
  return old;
end;
$$;

drop trigger if exists video_likes_counter on public.video_likes;
create trigger video_likes_counter
after insert or delete on public.video_likes
for each row execute function public.sync_video_counter();

drop trigger if exists video_saves_counter on public.video_saves;
create trigger video_saves_counter
after insert or delete on public.video_saves
for each row execute function public.sync_video_counter();

drop trigger if exists comments_counter on public.comments;
create trigger comments_counter
after insert or delete on public.comments
for each row execute function public.sync_video_counter();

drop trigger if exists follows_counter on public.follows;
create trigger follows_counter
after insert or delete on public.follows
for each row execute function public.sync_follow_counter();

update public.videos v
set
  likes_count = (select count(*) from public.video_likes vl where vl.video_id = v.id),
  saves_count = (select count(*) from public.video_saves vs where vs.video_id = v.id),
  comments_count = (select count(*) from public.comments c where c.video_id = v.id);

update public.profiles p
set followers_count = (select count(*) from public.follows f where f.author_id = p.user_id);

create or replace function public.toggle_video_like(
  p_user_id text,
  p_video_id integer
)
returns table(liked boolean, likes_count integer)
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('video-like:' || p_user_id || ':' || p_video_id, 0));

  delete from public.video_likes
  where user_id = p_user_id and video_id = p_video_id;

  if found then
    return query
      select false, v.likes_count from public.videos v where v.id = p_video_id;
  else
    insert into public.video_likes (user_id, video_id)
    values (p_user_id, p_video_id);
    return query
      select true, v.likes_count from public.videos v where v.id = p_video_id;
  end if;
end;
$$;

create or replace function public.toggle_video_save(
  p_user_id text,
  p_video_id integer
)
returns table(saved boolean, saves_count integer)
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('video-save:' || p_user_id || ':' || p_video_id, 0));

  delete from public.video_saves
  where user_id = p_user_id and video_id = p_video_id;

  if found then
    return query
      select false, v.saves_count from public.videos v where v.id = p_video_id;
  else
    insert into public.video_saves (user_id, video_id)
    values (p_user_id, p_video_id);
    return query
      select true, v.saves_count from public.videos v where v.id = p_video_id;
  end if;
end;
$$;

create or replace function public.toggle_author_follow(
  p_follower_id text,
  p_author_id text
)
returns table(following boolean, followers_count integer)
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_follower_id = p_author_id then
    raise exception 'A profile cannot follow itself.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('author-follow:' || p_follower_id || ':' || p_author_id, 0));

  delete from public.follows
  where follower_id = p_follower_id and author_id = p_author_id;

  if found then
    return query
      select false, p.followers_count from public.profiles p where p.user_id = p_author_id;
  else
    insert into public.follows (follower_id, author_id)
    values (p_follower_id, p_author_id);
    return query
      select true, p.followers_count from public.profiles p where p.user_id = p_author_id;
  end if;
end;
$$;

create or replace function public.add_video_comment(
  p_user_id text,
  p_video_id integer,
  p_body text
)
returns table(
  id integer,
  body text,
  created_at timestamptz,
  user_id text,
  comments_count integer
)
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if char_length(btrim(p_body)) not between 1 and 1000 then
    raise exception 'Comment length must be between 1 and 1000 characters.';
  end if;

  return query
    with inserted as (
      insert into public.comments (video_id, user_id, body)
      values (p_video_id, p_user_id, btrim(p_body))
      returning comments.id, comments.body, comments.created_at, comments.user_id
    )
    select i.id, i.body, i.created_at, i.user_id, v.comments_count
    from inserted i
    join public.videos v on v.id = p_video_id;
end;
$$;

revoke all on function public.toggle_video_like(text, integer) from public, anon, authenticated;
revoke all on function public.toggle_video_save(text, integer) from public, anon, authenticated;
revoke all on function public.toggle_author_follow(text, text) from public, anon, authenticated;
revoke all on function public.add_video_comment(text, integer, text) from public, anon, authenticated;
