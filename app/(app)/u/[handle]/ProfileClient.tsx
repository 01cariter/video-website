'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, Play, Sparkles } from 'lucide-react';
import type { AppUser, Profile, SocialToggle, Video } from '@/lib/types';
import { LEVEL_RULE, levelProgress } from '@/lib/levels';
import { postHeadline } from '@/lib/post-text';
import { fmtLikes, initials } from '@/app/components/media';
import { useMediaPreview } from '@/app/components/shell/MediaPreviewContext';
import { OPEN_COMPOSE_EVENT } from '@/app/components/shell/compose-events';

interface ProfileClientProps {
  user: AppUser | null;
  profile: Profile;
  posts: Video[];
  saved: Video[];
  isOwner: boolean;
}

type ProfileTab = 'posts' | 'saved';

function tileThumb(video: Video): string | null {
  const first = video.assets?.[0];
  if (first?.url) return first.url;
  return video.poster_url;
}

function tileHasVideo(video: Video): boolean {
  return (video.assets ?? []).some((asset) => asset.kind === 'video') || Boolean(video.video_url);
}

export default function ProfileClient({ user, profile, posts, saved, isOwner }: ProfileClientProps) {
  const router = useRouter();
  const { openPreview } = useMediaPreview();
  const [tab, setTab] = useState<ProfileTab>('posts');
  const [following, setFollowing] = useState(profile.following);
  const [followers, setFollowers] = useState(profile.followers_count);
  const [pending, setPending] = useState(false);

  const list = tab === 'saved' ? saved : posts;
  const progress = levelProgress(profile.xp);
  const loginNext = `/login?next=/u/${encodeURIComponent((profile.handle || '').replace(/^@+/, ''))}`;

  async function toggleFollow() {
    if (!user) {
      router.push(loginNext);
      return;
    }
    if (pending || isOwner) return;

    const optimistic = !following;
    setFollowing(optimistic);
    setFollowers((count) => Math.max(0, count + (optimistic ? 1 : -1)));
    setPending(true);
    try {
      const response = await fetch(`/api/authors/${encodeURIComponent(profile.user_id)}/follow`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Follow failed.');
      const data = (await response.json()) as SocialToggle;
      setFollowing(data.following ?? optimistic);
      if (typeof data.followers_count === 'number') setFollowers(data.followers_count);
    } catch {
      setFollowing(!optimistic);
      setFollowers((count) => Math.max(0, count + (optimistic ? -1 : 1)));
    } finally {
      setPending(false);
    }
  }

  function openTile(video: Video) {
    if ((video.assets?.length ?? 0) > 0) {
      openPreview({ video, playlist: list });
      return;
    }
    router.push(`/videos/${video.id}`);
  }

  return (
    <section className="pf pf-shell">
      <header className="pf-topbar">
        <button type="button" className="pd-back" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft aria-hidden="true" />
        </button>
        <div className="pf-topbar-title">
          <b>{profile.display_name}</b>
          {profile.handle && <span>{profile.handle}</span>}
        </div>
        <Link href="/" className="pf-home-link">
          Home
        </Link>
      </header>

      <header className="pf-head">
        <span className="pf-av" style={{ background: profile.avatar_color }}>
          {initials(profile.display_name)}
        </span>

        <div className="pf-id">
          <h1>{profile.display_name}</h1>
          <p className="pf-handle">{profile.handle}</p>
          {profile.bio && <p className="pf-bio">{profile.bio}</p>}

          <ul className="pf-stats">
            <li>
              <b>{fmtLikes(profile.posts_count)}</b>
              <span>posts</span>
            </li>
            <li>
              <b>{fmtLikes(followers)}</b>
              <span>followers</span>
            </li>
            <li>
              <b>{fmtLikes(profile.total_likes)}</b>
              <span>likes</span>
            </li>
          </ul>

          <div className="pf-level">
            <div className="pf-level-top">
              <b>Level {progress.level}</b>
              <span>
                {progress.into} / {progress.needed} XP
              </span>
            </div>
            <span
              className="pf-level-bar"
              role="progressbar"
              aria-valuenow={progress.into}
              aria-valuemin={0}
              aria-valuemax={progress.needed}
              aria-label={`Progress to level ${progress.level + 1}`}
            >
              <i style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
            </span>
            <small>
              {LEVEL_RULE}. {progress.remaining} XP to level {progress.level + 1}.
            </small>
          </div>
        </div>

        <div className="pf-actions">
          {isOwner ? (
            <button
              type="button"
              className="pf-primary"
              onClick={() => window.dispatchEvent(new Event(OPEN_COMPOSE_EVENT))}
            >
              Post
            </button>
          ) : (
            <button
              type="button"
              className={`pf-primary ${following ? 'on' : ''}`}
              onClick={() => void toggleFollow()}
              disabled={pending}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </header>

      {isOwner && (
        <div className="pf-tabs" role="tablist" aria-label="Profile sections">
          <button
            type="button"
            role="tab"
            className={tab === 'posts' ? 'on' : ''}
            aria-selected={tab === 'posts'}
            onClick={() => setTab('posts')}
          >
            Posts <span>{posts.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            className={tab === 'saved' ? 'on' : ''}
            aria-selected={tab === 'saved'}
            onClick={() => setTab('saved')}
          >
            Saved <span>{saved.length}</span>
          </button>
        </div>
      )}

      {list.length > 0 ? (
        <div className="pf-grid" role="list">
          {list.map((video) => {
            const thumb = tileThumb(video);
            const count = video.assets?.length ?? 0;
            const headline = postHeadline(video);
            return (
              <button
                key={video.id}
                type="button"
                role="listitem"
                className={thumb ? 'pf-tile' : 'pf-tile pf-tile-text'}
                style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                onClick={() => openTile(video)}
                aria-label={headline}
              >
                {!thumb && <span className="pf-tile-copy">{video.description || video.title || 'Post'}</span>}
                {tileHasVideo(video) && (
                  <span className="pf-tile-play" aria-hidden="true">
                    <Play />
                  </span>
                )}
                {count > 1 && <span className="pf-tile-count">{count}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          {tab === 'saved' ? <Bookmark aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          <p>
            {tab === 'saved'
              ? 'Nothing saved yet.'
              : isOwner
                ? 'You have not posted anything yet.'
                : `${profile.display_name} has not posted yet.`}
          </p>
          {isOwner && tab === 'posts' && (
            <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COMPOSE_EVENT))}>
              Post your first short
            </button>
          )}
        </div>
      )}
    </section>
  );
}
