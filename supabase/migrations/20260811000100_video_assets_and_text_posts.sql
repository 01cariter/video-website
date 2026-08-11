-- Multi-media posts (0–20 assets) + optional title / body-only text posts.

alter table public.videos
  alter column title drop not null;

alter table public.videos
  alter column title set default null;

create table if not exists public.video_assets (
  video_id integer not null references public.videos(id) on delete cascade,
  media_id integer not null references public.media(id) on delete cascade,
  position integer not null check (position >= 0 and position < 20),
  primary key (video_id, position),
  unique (video_id, media_id)
);

create index if not exists idx_video_assets_media on public.video_assets (media_id);

-- Backfill: prefer the playable video; otherwise the poster/image.
-- Do not insert both — poster frames are covers, not carousel items.
insert into public.video_assets (video_id, media_id, position)
select v.id, coalesce(v.video_media_id, v.poster_media_id), 0
from public.videos v
where coalesce(v.video_media_id, v.poster_media_id) is not null
  and not exists (
    select 1 from public.video_assets va where va.video_id = v.id
  )
on conflict do nothing;
