'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bookmark,
  Heart,
  Pencil,
  Play,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  AppUser,
  Profile,
  ProfileSummary,
  SocialToggle,
  Video,
} from '@/lib/types';
import { levelProgress } from '@/lib/levels';
import { postHeadline } from '@/lib/post-text';
import {
  avatarStyle,
  fmtLikes,
  initials,
  profileHref,
} from '@/app/components/media';
import DeleteMenu from '@/app/components/feed/DeleteMenu';
import PersonRow from '@/app/components/feed/PersonRow';
import { useMediaPreview } from '@/app/components/shell/MediaPreviewContext';
import {
  OPEN_COMPOSE_EVENT,
  POST_DELETED_EVENT,
} from '@/app/components/shell/compose-events';
import ProfileEditDialog, { type ProfileEdits } from './ProfileEditDialog';

interface ProfileClientProps {
  user: AppUser | null;
  profile: Profile;
  posts: Video[];
  saved: Video[];
  followers: ProfileSummary[];
  isOwner: boolean;
}

type ProfileView = 'posts' | 'followers' | 'likes' | 'saved';

function tileThumb(video: Video): string | null {
  const first = video.assets?.[0];
  if (first?.url) return first.url;
  return video.poster_url;
}

function tileHasVideo(video: Video): boolean {
  return (
    (video.assets ?? []).some((asset) => asset.kind === 'video') ||
    Boolean(video.video_url)
  );
}

export default function ProfileClient({
  user,
  profile,
  posts,
  saved,
  followers: profileFollowers,
  isOwner,
}: ProfileClientProps) {
  const router = useRouter();
  const { openPreview } = useMediaPreview();
  const [view, setView] = useState<ProfileView>('posts');
  const [profilePosts, setProfilePosts] = useState(posts);
  const [profileSaved, setProfileSaved] = useState(saved);
  const [following, setFollowing] = useState(profile.following);
  const [followersCount, setFollowersCount] = useState(profile.followers_count);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  // Applied locally so the hero updates before the server component refetches.
  const [details, setDetails] = useState<ProfileEdits>({
    display_name: profile.display_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    avatar_media_id: profile.avatar_media_id,
  });
  const shownProfile = { ...profile, ...details };

  useEffect(() => {
    function handleDeleted(event: Event) {
      const id = (event as CustomEvent<number | undefined>).detail;
      if (typeof id !== 'number' || !Number.isInteger(id)) return;
      setProfilePosts((items) => items.filter((item) => item.id !== id));
      setProfileSaved((items) => items.filter((item) => item.id !== id));
    }
    window.addEventListener(POST_DELETED_EVENT, handleDeleted);
    return () => window.removeEventListener(POST_DELETED_EVENT, handleDeleted);
  }, []);

  const likedPosts = useMemo(
    () =>
      profilePosts
        .filter((post) => post.likes_count > 0)
        .sort(
          (first, second) =>
            second.likes_count - first.likes_count ||
            new Date(second.created_at).getTime() -
              new Date(first.created_at).getTime(),
        ),
    [profilePosts],
  );
  const list =
    view === 'saved'
      ? profileSaved
      : view === 'likes'
        ? likedPosts
        : profilePosts;
  const deletedPostCount = Math.max(0, posts.length - profilePosts.length);
  const postsCount = Math.max(0, profile.posts_count - deletedPostCount);
  const deletedLikes =
    posts.reduce((total, post) => total + post.likes_count, 0) -
    profilePosts.reduce((total, post) => total + post.likes_count, 0);
  const totalLikes = Math.max(0, profile.total_likes - deletedLikes);
  const progress = levelProgress(profile.xp);
  const loginNext = `/login?next=/u/${encodeURIComponent(
    (profile.handle || '').replace(/^@+/, ''),
  )}`;

  async function toggleFollow() {
    if (!user) {
      router.push(loginNext);
      return;
    }
    if (pending || isOwner) return;

    const optimistic = !following;
    setFollowing(optimistic);
    setFollowersCount((count) =>
      Math.max(0, count + (optimistic ? 1 : -1)),
    );
    setPending(true);
    try {
      const response = await fetch(
        `/api/authors/${encodeURIComponent(profile.user_id)}/follow`,
        { method: 'POST' },
      );
      if (!response.ok) throw new Error('Follow failed.');
      const data = (await response.json()) as SocialToggle;
      setFollowing(data.following ?? optimistic);
      if (typeof data.followers_count === 'number') {
        setFollowersCount(data.followers_count);
      }
      router.refresh();
    } catch {
      setFollowing(!optimistic);
      setFollowersCount((count) =>
        Math.max(0, count + (optimistic ? -1 : 1)),
      );
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

  async function deletePost(video: Video) {
    const response = await fetch(`/api/videos/${video.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Post deletion failed.');
    window.dispatchEvent(
      new CustomEvent(POST_DELETED_EVENT, { detail: video.id }),
    );
  }

  return (
    <section className="pf pf-shell">
      <header className="pf-topbar">
        <button
          type="button"
          className="pd-back"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <div className="pf-topbar-title">
          <b>{isOwner ? 'Profile' : shownProfile.display_name}</b>
        </div>
      </header>

      <section className="pf-hero">
        <div className="pf-identity">
          <span
            className="pf-av"
            style={avatarStyle(profile.avatar_color, shownProfile.avatar_url)}
          >
            {initials(shownProfile.display_name)}
          </span>

          <div className="pf-id">
            <div className="pf-name-row">
              <div className="pf-name">
                <h1>{shownProfile.display_name}</h1>
                <p className="pf-handle">{profile.handle}</p>
              </div>

              <div className="pf-actions">
                {isOwner ? (
                  <>
                    <button
                      type="button"
                      className="pf-secondary"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil aria-hidden="true" />
                      Edit profile
                    </button>
                    <button
                      type="button"
                      className="pf-primary"
                      onClick={() =>
                        window.dispatchEvent(new Event(OPEN_COMPOSE_EVENT))
                      }
                    >
                      New post
                    </button>
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
            </div>

            {shownProfile.bio ? (
              <p className="pf-bio">{shownProfile.bio}</p>
            ) : (
              <p className="pf-bio pf-bio-muted">
                {isOwner
                  ? 'Add a short bio to tell people what you create.'
                  : 'This creator has not added a bio yet.'}
              </p>
            )}

            <div className="pf-level">
              <div className="pf-level-top">
                <span>
                  <b>Level {progress.level}</b>
                  {progress.into} / {progress.needed} XP
                </span>
                <span>{progress.remaining} to next level</span>
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
            </div>
          </div>
        </div>
      </section>

      <nav className="pf-stats" aria-label="Profile views">
        <button
          type="button"
          className={view === 'posts' ? 'on' : ''}
          onClick={() => setView('posts')}
          aria-pressed={view === 'posts'}
        >
          <span>Posts</span>
          <b>{fmtLikes(postsCount)}</b>
        </button>
        <button
          type="button"
          className={view === 'followers' ? 'on' : ''}
          onClick={() => setView('followers')}
          aria-pressed={view === 'followers'}
        >
          <span>Followers</span>
          <b>{fmtLikes(followersCount)}</b>
        </button>
        <button
          type="button"
          className={view === 'likes' ? 'on' : ''}
          onClick={() => setView('likes')}
          aria-pressed={view === 'likes'}
        >
          <span>Likes</span>
          <b>{fmtLikes(totalLikes)}</b>
        </button>
        {isOwner && (
          <button
            type="button"
            className={view === 'saved' ? 'on' : ''}
            onClick={() => setView('saved')}
            aria-pressed={view === 'saved'}
          >
            <span>Saved</span>
            <b>{fmtLikes(profileSaved.length)}</b>
          </button>
        )}
      </nav>

      <section className="pf-content">
        {view === 'followers' ? (
          profileFollowers.length > 0 ? (
            <div className="pf-people" role="list">
              {profileFollowers.map((follower) => (
                <PersonRow key={follower.user_id} person={follower} />
              ))}
            </div>
          ) : (
            <ProfileEmpty
              icon={<Users aria-hidden="true" />}
              message="No followers yet."
            />
          )
        ) : list.length > 0 ? (
          <div className="pf-grid" role="list">
            {list.map((video) => {
              const thumb = tileThumb(video);
              const count = video.assets?.length ?? 0;
              const headline = postHeadline(video);
              const canDelete = user?.id === video.author_id;
              return (
                <article
                  key={video.id}
                  role="listitem"
                  className={thumb ? 'pf-tile' : 'pf-tile pf-tile-text'}
                  style={
                    thumb ? { backgroundImage: `url(${thumb})` } : undefined
                  }
                >
                  <button
                    type="button"
                    className="pf-tile-open"
                    onClick={() => openTile(video)}
                    aria-label={headline}
                  >
                    {!thumb && (
                      <span className="pf-tile-copy">
                        {video.description || video.title || 'Post'}
                      </span>
                    )}
                    {tileHasVideo(video) && (
                      <span className="pf-tile-play" aria-hidden="true">
                        <Play />
                      </span>
                    )}
                    {count > 1 && (
                      <span className="pf-tile-count">{count}</span>
                    )}
                    {view === 'likes' && (
                      <span className="pf-tile-likes">
                        <Heart aria-hidden="true" />
                        <span className="tabular-nums">
                          {fmtLikes(video.likes_count)}
                        </span>
                      </span>
                    )}
                  </button>
                  {canDelete && (
                    <DeleteMenu
                      itemLabel="post"
                      className="pf-tile-menu"
                      onDelete={() => deletePost(video)}
                    />
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <ProfileEmpty
            icon={
              view === 'saved' ? (
                <Bookmark aria-hidden="true" />
              ) : view === 'likes' ? (
                <Heart aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )
            }
            message={
              view === 'saved'
                ? 'Nothing saved yet.'
                : view === 'likes'
                  ? 'No posts have collected likes yet.'
                  : isOwner
                    ? 'You have not posted anything yet.'
                    : `${shownProfile.display_name} has not posted yet.`
            }
            action={
              isOwner && view === 'posts'
                ? () => window.dispatchEvent(new Event(OPEN_COMPOSE_EVENT))
                : undefined
            }
          />
        )}
      </section>

      {editing && (
        <ProfileEditDialog
          profile={shownProfile}
          onClose={() => setEditing(false)}
          onSaved={(edits) => {
            setDetails(edits);
            setEditing(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function ProfileEmpty({
  icon,
  message,
  action,
}: {
  icon: ReactNode;
  message: string;
  action?: () => void;
}) {
  return (
    <div className="empty pf-empty">
      {icon}
      <p>{message}</p>
      {action && (
        <button type="button" onClick={action}>
          Create your first post
        </button>
      )}
    </div>
  );
}
