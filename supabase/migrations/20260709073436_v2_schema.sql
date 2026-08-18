-- ============================================================================
-- Video Website — Supabase Postgres schema (business data only)
-- Authentication is handled by Supabase Auth (managed `auth` schema).
-- Historical baseline fetched from the production migration history.
-- ============================================================================

drop table if exists comments cascade;
drop table if exists video_saves cascade;
drop table if exists video_likes cascade;
drop table if exists follows cascade;
drop table if exists projects cascade;
drop table if exists videos cascade;
drop table if exists media cascade;
drop table if exists creators cascade;
drop table if exists profiles cascade;
drop table if exists otp_codes cascade;
drop table if exists identities cascade;
drop table if exists sessions cascade;
drop table if exists users cascade;

create table profiles (
  user_id text primary key,
  handle text unique,
  display_name text,
  bio text,
  avatar_color text not null default '#3f7d92',
  avatar_media_id integer,
  level integer not null default 1,
  streak integer not null default 0,
  followers_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_profiles_handle on profiles (handle);

create table media (
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
create index idx_media_owner on media (owner_id);
create index idx_media_kind on media (kind);

create table videos (
  id serial primary key,
  title text not null,
  description text,
  category text not null check (category in ('study', 'play')),
  label text,
  size text not null default '',
  author_id text not null references profiles(user_id) on delete cascade,
  poster_media_id integer references media(id) on delete set null,
  video_media_id integer references media(id) on delete set null,
  duration text not null default '',
  likes_count integer not null default 0,
  saves_count integer not null default 0,
  comments_count integer not null default 0,
  views_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_videos_category on videos (category);
create index idx_videos_author on videos (author_id);

create table video_likes (
  user_id text not null,
  video_id integer not null references videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create index idx_video_likes_user on video_likes (user_id);

create table video_saves (
  user_id text not null,
  video_id integer not null references videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create index idx_video_saves_user on video_saves (user_id);

create table follows (
  follower_id text not null,
  author_id text not null references profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, author_id),
  check (follower_id <> author_id)
);
create index idx_follows_author on follows (author_id);

create table comments (
  id serial primary key,
  video_id integer not null references videos(id) on delete cascade,
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_comments_video on comments (video_id, created_at desc);

create table projects (
  id serial primary key,
  user_id text not null,
  name text not null,
  status text not null default 'draft',
  media_ids integer[] not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_projects_user on projects (user_id);

alter table projects
  add column if not exists nodes jsonb not null default '[]';
alter table projects
  add column if not exists edges jsonb not null default '[]';
alter table projects
  add column if not exists updated_at timestamptz not null default now();

create table if not exists agent_messages (
  id serial primary key,
  project_id integer not null references projects(id) on delete cascade,
  user_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_messages_project
  on agent_messages (project_id);
