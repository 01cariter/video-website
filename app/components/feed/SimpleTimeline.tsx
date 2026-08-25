'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import type { AppUser, FeedPage, ProfileSummary, SocialToggle, Video } from '@/lib/types';
import { useShellSearch } from '../shell/AppShell';
import { POST_DELETED_EVENT } from '../shell/compose-events';
import AuthModal from '../AuthModal';
import ActionNotice from './ActionNotice';
import FollowingCreators from './FollowingCreators';
import { requestSocialAction } from './social-action';
import TimelineFeed from './TimelineFeed';

export type SimpleTimelineSource = 'following' | 'bookmarks';

interface SimpleTimelineProps {
  user: AppUser | null;
  source: SimpleTimelineSource;
  initialVideos: Video[];
  initialNextCursor?: string | null;
  initialAuthors?: ProfileSummary[];
}

const NEXT_PATH: Record<SimpleTimelineSource, string> = {
  following: '/following',
  bookmarks: '/bookmarks',
};

function defaultEmptyMessage(
  source: SimpleTimelineSource,
  user: AppUser | null,
  followingCount: number,
): string {
  if (source === 'bookmarks') return 'You have not bookmarked anything yet.';
  return user
    ? followingCount > 0
      ? 'The people you follow have not posted yet.'
      : 'Follow creators to see their posts here.'
    : 'Sign in to see posts from people you follow.';
}

function followingQuery(cursor: string | null): string {
  const search = new URLSearchParams({ limit: '12', mode: 'following' });
  if (cursor) search.set('cursor', cursor);
  return `/api/videos?${search.toString()}`;
}

export default function SimpleTimeline({
  user,
  source,
  initialVideos,
  initialNextCursor = null,
  initialAuthors = [],
}: SimpleTimelineProps) {
  const { query } = useShellSearch();
  const [videos, setVideos] = useState(initialVideos);
  const [nextCursor, setNextCursor] = useState(source === 'following' ? initialNextCursor : null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [actionError, setActionError] = useState('');

  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);
  const pending = useRef(new Set<string>());

  const needAuth = useCallback(() => setAuthMode('login'), []);

  const patchVideo = useCallback((id: number, patch: Partial<Video>) => {
    setVideos((items) => items.map((video) => (video.id === id ? { ...video, ...patch } : video)));
  }, []);

  useEffect(() => {
    function handleDeleted(event: Event) {
      const id = (event as CustomEvent<number | undefined>).detail;
      if (typeof id !== 'number' || !Number.isInteger(id)) return;
      setVideos((items) => items.filter((item) => item.id !== id));
    }
    window.addEventListener(POST_DELETED_EVENT, handleDeleted);
    return () => window.removeEventListener(POST_DELETED_EVENT, handleDeleted);
  }, []);

  const like = useCallback(
    async (video: Video) => {
      const key = `like-${video.id}`;
      if (pending.current.has(key)) return;
      pending.current.add(key);
      const optimistic = !video.liked;
      patchVideo(video.id, {
        liked: optimistic,
        likes_count: Math.max(0, video.likes_count + (optimistic ? 1 : -1)),
      });
      setActionError('');
      try {
        const data = await requestSocialAction<SocialToggle>(
          `/api/videos/${video.id}/like`,
          { onUnauthorized: needAuth },
        );
        if (data) {
          patchVideo(video.id, { liked: data.liked ?? optimistic, likes_count: data.likes_count ?? video.likes_count });
        } else {
          patchVideo(video.id, { liked: video.liked, likes_count: video.likes_count });
        }
      } catch {
        patchVideo(video.id, { liked: video.liked, likes_count: video.likes_count });
        setActionError('Could not update this like. Try again.');
      } finally {
        pending.current.delete(key);
      }
    },
    [needAuth, patchVideo],
  );

  const save = useCallback(
    async (video: Video) => {
      const key = `save-${video.id}`;
      if (pending.current.has(key)) return;
      pending.current.add(key);
      const optimistic = !video.saved;
      // Bookmarks is a list of saved posts, so unsaving one here should drop
      // the row entirely rather than leave a "saved: false" post behind.
      const isBookmarksUnsave = source === 'bookmarks' && !optimistic;
      const removedAt = isBookmarksUnsave
        ? videos.findIndex((item) => item.id === video.id)
        : -1;

      if (isBookmarksUnsave) {
        setVideos((items) => items.filter((item) => item.id !== video.id));
      } else {
        patchVideo(video.id, {
          saved: optimistic,
          saves_count: Math.max(0, video.saves_count + (optimistic ? 1 : -1)),
        });
      }

      function restore() {
        if (isBookmarksUnsave) {
          setVideos((items) => {
            if (items.some((item) => item.id === video.id)) return items;
            const next = items.slice();
            const at = removedAt >= 0 ? Math.min(removedAt, next.length) : next.length;
            next.splice(at, 0, video);
            return next;
          });
        } else {
          patchVideo(video.id, { saved: video.saved, saves_count: video.saves_count });
        }
      }

      setActionError('');
      try {
        const data = await requestSocialAction<SocialToggle>(
          `/api/videos/${video.id}/save`,
          { onUnauthorized: needAuth },
        );
        if (data) {
          const savedResult = data.saved ?? optimistic;
          if (isBookmarksUnsave) {
            // Server disagrees with the optimistic unsave — put the row back.
            if (savedResult) restore();
          } else {
            patchVideo(video.id, { saved: savedResult, saves_count: data.saves_count ?? video.saves_count });
          }
        } else {
          restore();
        }
      } catch {
        restore();
        setActionError('Could not update this bookmark. Try again.');
      } finally {
        pending.current.delete(key);
      }
    },
    [needAuth, patchVideo, source, videos],
  );

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
      // Native share sheets reject when the user cancels — nothing to do.
    }
  }

  async function deletePost(video: Video) {
    const response = await fetch(`/api/videos/${video.id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Post deletion failed.');
    window.dispatchEvent(new CustomEvent(POST_DELETED_EVENT, { detail: video.id }));
  }

  const fetchFollowingPage = useCallback(async (cursor: string | null): Promise<FeedPage> => {
    const response = await fetch(followingQuery(cursor));
    if (!response.ok) throw new Error('Feed request failed.');
    return response.json() as Promise<FeedPage>;
  }, []);

  const fetchBookmarks = useCallback(async (): Promise<Video[]> => {
    const response = await fetch('/api/bookmarks');
    if (!response.ok) throw new Error('Bookmarks request failed.');
    const data = (await response.json()) as { videos: Video[] };
    return data.videos;
  }, []);

  const loadMore = useCallback(async () => {
    if (source !== 'following' || !nextCursor || loading || loadingMoreRef.current) return;
    const id = requestId.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(false);
    try {
      const page = await fetchFollowingPage(nextCursor);
      if (id !== requestId.current) return;
      setVideos((items) => {
        const known = new Set(items.map((item) => item.id));
        return [...items, ...page.videos.filter((item) => !known.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      loadingMoreRef.current = false;
      if (id === requestId.current) setLoadingMore(false);
    }
  }, [fetchFollowingPage, loading, nextCursor, source]);

  const retry = useCallback(async () => {
    const id = ++requestId.current;
    setError(false);

    if (source === 'bookmarks') {
      setLoading(true);
      try {
        const items = await fetchBookmarks();
        if (id !== requestId.current) return;
        setVideos(items);
      } catch {
        if (id === requestId.current) setError(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
      return;
    }

    if (videos.length > 0) {
      void loadMore();
      return;
    }

    setLoading(true);
    setVideos([]);
    setNextCursor(null);
    try {
      const page = await fetchFollowingPage(null);
      if (id !== requestId.current) return;
      setVideos(page.videos);
      setNextCursor(page.nextCursor);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fetchBookmarks, fetchFollowingPage, loadMore, source, videos.length]);

  const list = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return videos;
    return videos.filter(
      (video) =>
        (video.title || '').toLowerCase().includes(normalized) ||
        (video.description || '').toLowerCase().includes(normalized) ||
        (video.author_handle || '').toLowerCase().includes(normalized) ||
        video.author_name.toLowerCase().includes(normalized),
    );
  }, [query, videos]);

  const emptyMessage = query.trim()
    ? `No posts match “${query.trim()}”.`
    : defaultEmptyMessage(source, user, initialAuthors.length);

  return (
    <div className="t-home">
      {source === 'following' && <FollowingCreators authors={initialAuthors} />}
      {source === 'following' && initialAuthors.length > 0 && (
        <header className="fg-feed-head">
          <span>Latest posts</span>
          <small>From people in your circle</small>
        </header>
      )}
      <TimelineFeed
        videos={list}
        user={user}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        nextCursor={source === 'following' ? nextCursor : null}
        emptyMessage={emptyMessage}
        onLoadMore={() => void loadMore()}
        onRetry={() => void retry()}
        onLike={(video) => void like(video)}
        onSave={(video) => void save(video)}
        onShare={(video) => void share(video)}
        onDelete={deletePost}
        onNeedAuth={needAuth}
      />

      <ActionNotice
        message={actionError}
        onDismiss={() => setActionError('')}
      />

      <AnimatePresence>
        {authMode && (
          <AuthModal
            mode={authMode}
            nextPath={NEXT_PATH[source]}
            onClose={() => setAuthMode(null)}
            onModeChange={setAuthMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
