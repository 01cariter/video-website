'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, Sparkles } from 'lucide-react';
import type { AppUser, Profile, SocialToggle, Video } from '@/lib/types';
import { LEVEL_RULE, levelProgress } from '@/lib/levels';
import { fmtLikes, initials } from '@/app/components/media';
import TimelinePost from '@/app/components/feed/TimelinePost';
import { OPEN_COMPOSE_EVENT } from '@/app/components/shell/compose-events';

interface ProfileClientProps {
  user: AppUser | null;
  profile: Profile;
  posts: Video[];
  saved: Video[];
  isOwner: boolean;
}

type ProfileTab = 'posts' | 'saved';

export default function ProfileClient({ user, profile, posts, saved, isOwner }: ProfileClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<ProfileTab>('posts');
  const [following, setFollowing] = useState(profile.following);
  const [followers, setFollowers] = useState(profile.followers_count);
  const [pending, setPending] = useState(false);
  const [items, setItems] = useState(() => ({ posts, saved }));

  const list = tab === 'saved' ? items.saved : items.posts;
  const progress = levelProgress(profile.xp);

  async function toggleFollow() {
    if (!user) {
      router.push(`/login?next=/u/${encodeURIComponent((profile.handle || '').replace(/^@+/, ''))}`);
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

  function patchVideo(id: number, patch: Partial<Video>) {
    setItems((state) => ({
      posts: state.posts.map((video) => (video.id === id ? { ...video, ...patch } : video)),
      saved: state.saved.map((video) => (video.id === id ? { ...video, ...patch } : video)),
    }));
  }

  async function like(video: Video) {
    if (!user) return;
    const optimistic = !video.liked;
    patchVideo(video.id, {
      liked: optimistic,
      likes_count: Math.max(0, video.likes_count + (optimistic ? 1 : -1)),
    });
    const response = await fetch(`/api/videos/${video.id}/like`, { method: 'POST' });
    if (!response.ok) {
      patchVideo(video.id, { liked: video.liked, likes_count: video.likes_count });
      return;
    }
    const data = (await response.json()) as SocialToggle;
    patchVideo(video.id, {
      liked: data.liked ?? optimistic,
      likes_count: data.likes_count ?? video.likes_count,
    });
  }

  async function save(video: Video) {
    if (!user) return;
    const optimistic = !video.saved;
    if (tab === 'saved' && !optimistic) {
      setItems((state) => ({
        ...state,
        saved: state.saved.filter((item) => item.id !== video.id),
      }));
    } else {
      patchVideo(video.id, {
        saved: optimistic,
        saves_count: Math.max(0, video.saves_count + (optimistic ? 1 : -1)),
      });
    }
    const response = await fetch(`/api/videos/${video.id}/save`, { method: 'POST' });
    if (!response.ok) {
      router.refresh();
      return;
    }
    const data = (await response.json()) as SocialToggle;
    if (tab !== 'saved' || (data.saved ?? optimistic)) {
      patchVideo(video.id, {
        saved: data.saved ?? optimistic,
        saves_count: data.saves_count ?? video.saves_count,
      });
    }
  }

  async function share(video: Video) {
    const url = `${window.location.origin}/videos/${video.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title || video.description || 'Snackd',
          text: video.description || undefined,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // cancelled
    }
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
            Posts <span>{items.posts.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            className={tab === 'saved' ? 'on' : ''}
            aria-selected={tab === 'saved'}
            onClick={() => setTab('saved')}
          >
            Saved <span>{items.saved.length}</span>
          </button>
        </div>
      )}

      {list.length > 0 ? (
        <div className="t-feed">
          {list.map((video) => (
            <TimelinePost
              key={video.id}
              video={video}
              user={user}
              playlist={list}
              onLike={(item) => void like(item)}
              onSave={(item) => void save(item)}
              onShare={(item) => void share(item)}
              onNeedAuth={() =>
                router.push(
                  `/login?next=/u/${encodeURIComponent((profile.handle || '').replace(/^@+/, ''))}`,
                )
              }
            />
          ))}
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
