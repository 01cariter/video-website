-- Manual episode order. Until now a collection was ordered by publication
-- date, which is right by default but leaves no way to move an episode.
-- Existing rows are backfilled with their current order, so nothing moves.

alter table public.videos
  add column if not exists collection_position integer;

update public.videos v
set collection_position = ordered.position
from (
  select id, row_number() over (
    partition by collection_id order by created_at asc, id asc
  ) as position
  from public.videos
  where collection_id is not null
) ordered
where v.id = ordered.id
  and v.collection_id is not null
  and v.collection_position is null;

drop index if exists public.idx_videos_collection;
create index if not exists idx_videos_collection
  on public.videos (collection_id, collection_position, created_at, id);
