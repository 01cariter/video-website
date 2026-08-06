'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { ArrowLeft, Bookmark, Flame, Plus, Sparkles } from 'lucide-react';
import type { AppUser, Profile, SocialToggle, Video } from '@/lib/types';
import { getSoloUrl } from '@/lib/solo';
import CreateModal from '@/app/components/CreateModal';
import { fmtLikes, initials } from '@/app/components/media';
import VideoCard from '@/app/components/VideoCard';

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
  const [createOpen, setCreateOpen] = useState(false);

  const list = tab === 'saved' ? saved : posts;

  useEffect(() => {
    document.body.style.overflow = createOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [createOpen]);

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

  return (
    <main className="pf">
      <div className="pf-inner">
        <Link className="pf-back" href="/">
          <ArrowLeft aria-hidden="true" />
          <span>Back to feed</span>
        </Link>

        <header className="pf-head">
          <span className="pf-av" style={{ background: profile.avatar_color }}>
            {initials(profile.display_name)}
          </span>

          <div className="pf-id">
            <h1>{profile.display_name}</h1>
            <p className="pf-handle">{profile.handle}</p>
            {profile.bio && <p className="pf-bio">{profile.bio}</p>}

            <ul className="pf-stats">
              <li><b>{fmtLikes(profile.posts_count)}</b><span>posts</span></li>
              <li><b>{fmtLikes(followers)}</b><span>followers</span></li>
              <li><b>{fmtLikes(profile.total_likes)}</b><span>likes</span></li>
            </ul>
          </div>

          <div className="pf-actions">
            {isOwner ? (
              <>
                <button
                  type="button"
                  className="pf-primary"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus aria-hidden="true" />
                  <span>Create</span>
                </button>
                <span className="pf-streak">
                  <Flame aria-hidden="true" />
                  Lvl {profile.level} · {profile.streak} day streak
                </span>
              </>
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
          <div className="grid">
            {list.map((video, index) => {
              const patternIndex = index % 8;
              const sizeClass = patternIndex === 0 ? 'big' : patternIndex === 1 ? 'tall' : '';
              return (
                <VideoCard
                  key={video.id}
                  video={video}
                  index={index}
                  sizeClass={sizeClass}
                  onOpen={(item) => router.push(`/videos/${item.id}`)}
                  onWarm={(item) => router.prefetch(`/videos/${item.id}`)}
                />
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
              <button type="button" onClick={() => setCreateOpen(true)}>
                Upload your first short
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {createOpen && user && (
          <CreateModal
            user={user}
            soloUrl={getSoloUrl()}
            onClose={() => setCreateOpen(false)}
            onPublished={() => {
              setCreateOpen(false);
              // Posts arrive as a server prop, so a refresh is what redraws the
              // grid with the new one — on the tab that actually shows it.
              setTab('posts');
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
