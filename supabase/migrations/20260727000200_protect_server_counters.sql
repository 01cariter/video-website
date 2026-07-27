-- Keep public-client writes away from server-maintained counters.

begin;

update public.profiles
set
  level = greatest(level, 1),
  streak = greatest(streak, 0),
  followers_count = greatest(followers_count, 0);

update public.videos
set
  likes_count = greatest(likes_count, 0),
  saves_count = greatest(saves_count, 0),
  comments_count = greatest(comments_count, 0),
  views_count = greatest(views_count, 0);

alter table public.profiles
  drop constraint if exists profiles_nonnegative_counters;
alter table public.profiles
  add constraint profiles_nonnegative_counters check (
    level >= 1 and streak >= 0 and followers_count >= 0
  );

alter table public.videos
  drop constraint if exists videos_nonnegative_counters;
alter table public.videos
  add constraint videos_nonnegative_counters check (
    likes_count >= 0
    and saves_count >= 0
    and comments_count >= 0
    and views_count >= 0
  );

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
grant update (body) on public.comments to authenticated;

commit;
