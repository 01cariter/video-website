'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import type { AppUser, FeedPage, SocialToggle, Video, VideoCategory } from '@/lib/types';
import {
  addCustomTab,
  getCustomTabsServerSnapshot,
  getCustomTabsSnapshot,
  removeCustomTab,
  subscribeCustomTabs,
  writeCustomTabs,
} from '@/lib/feed-tabs';
import { useShellSearch } from '../shell/AppShell';
import { PUBLISHED_EVENT } from '../shell/compose-events';
import AuthModal from '../AuthModal';
import FeedTabs, { type HomeTabId } from './FeedTabs';
import TimelineFeed from './TimelineFeed';

interface HomeTimelineProps {
  user: AppUser | null;
  initialVideos: Video[];
  initialNextCursor: string | null;
}

interface HomeTimelineInnerProps extends HomeTimelineProps {
  initialTab: HomeTabId;
}

function feedQuery(tab: HomeTabId, cursor: string | null): string {
  const search = new URLSearchParams({ limit: '12' });
  if (tab === 'following') {
    search.set('mode', 'following');
  } else if (tab !== 'foryou') {
    search.set('mode', 'foryou');
    search.set('category', tab);
  }
  if (cursor) search.set('cursor', cursor);
  return `/api/videos?${search.toString()}`;
}

function parseHomeTabParam(value: string | null): HomeTabId | null {
  if (value === 'following' || value === 'foryou' || value === 'study' || value === 'play') return value;
  return null;
}

export default function HomeTimeline(props: HomeTimelineProps) {
  const searchParams = useSearchParams();
  const tabParam = parseHomeTabParam(searchParams.get('tab')) ?? 'foryou';
  return <HomeTimelineInner key={tabParam} {...props} initialTab={tabParam} />;
}

function HomeTimelineInner({ user, initialVideos, initialNextCursor, initialTab }: HomeTimelineInnerProps) {
  const { query } = useShellSearch();
  const [tab, setTab] = useState<HomeTabId>(initialTab);
  // Custom category tabs are per-browser (localStorage). Reading them via
  // `useSyncExternalStore` keeps the server's tabless render and the
  // client's stored tabs consistent without a `setState` in an effect.
  const customTabs = useSyncExternalStore(subscribeCustomTabs, getCustomTabsSnapshot, getCustomTabsServerSnapshot);
  const [videos, setVideos] = useState(initialTab === 'foryou' ? initialVideos : []);
  const [nextCursor, setNextCursor] = useState(initialTab === 'foryou' ? initialNextCursor : null);
  const [loading, setLoading] = useState(initialTab !== 'foryou');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);

  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);
  const feedCache = useRef(
    new Map<HomeTabId, FeedPage>(
      initialTab === 'foryou'
        ? [['foryou', { videos: initialVideos, nextCursor: initialNextCursor }]]
        : [],
    ),
  );
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  // Compose publishes from an overlay above this tree (Post modal, or Studio
  // via the shell), so a freshly published post arrives as a window event
  // rather than a prop — prepend it here only while looking at For You.
  useEffect(() => {
    function handlePublished(event: Event) {
      const video = (event as CustomEvent<Video | undefined>).detail;
      if (!video || tabRef.current !== 'foryou') return;
      setVideos((items) => (items.some((item) => item.id === video.id) ? items : [video, ...items]));
    }
    window.addEventListener(PUBLISHED_EVENT, handlePublished);
    return () => window.removeEventListener(PUBLISHED_EVENT, handlePublished);
  }, []);

  // Non-For-You deep links remount with empty state; load the first page once.
  // Also persist Study/Entertainment onto the custom tab strip.
  useEffect(() => {
    if (initialTab === 'study' || initialTab === 'play') {
      writeCustomTabs(addCustomTab(getCustomTabsSnapshot(), initialTab));
    }
    if (initialTab === 'foryou') return;
    let cancelled = false;
    void fetch(feedQuery(initialTab, null))
      .then((response) => {
        if (!response.ok) throw new Error('Feed request failed.');
        return response.json() as Promise<FeedPage>;
      })
      .then((page) => {
        if (cancelled) return;
        feedCache.current.set(initialTab, page);
        setVideos(page.videos);
        setNextCursor(page.nextCursor);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialTab]);

  const needAuth = useCallback(() => setAuthMode('login'), []);

  const patchVideo = useCallback((id: number, patch: Partial<Video>) => {
    setVideos((items) => items.map((video) => (video.id === id ? { ...video, ...patch } : video)));
  }, []);

  const act = useCallback(async <T,>(url: string): Promise<T | null> => {
    const response = await fetch(url, { method: 'POST' });
    if (response.status === 401) {
      needAuth();
      return null;
    }
    if (!response.ok) return null;
    return response.json() as Promise<T>;
  }, [needAuth]);

  const like = useCallback(
    async (video: Video) => {
      const key = `like-${video.id}`;
      if (pending[key]) return;
      const optimistic = !video.liked;
      patchVideo(video.id, {
        liked: optimistic,
        likes_count: Math.max(0, video.likes_count + (optimistic ? 1 : -1)),
      });
      setPending((state) => ({ ...state, [key]: true }));
      try {
        const data = await act<SocialToggle>(`/api/videos/${video.id}/like`);
        if (data) {
          patchVideo(video.id, { liked: data.liked ?? optimistic, likes_count: data.likes_count ?? video.likes_count });
        } else {
          patchVideo(video.id, { liked: video.liked, likes_count: video.likes_count });
        }
      } catch {
        patchVideo(video.id, { liked: video.liked, likes_count: video.likes_count });
      } finally {
        setPending((state) => ({ ...state, [key]: false }));
      }
    },
    [act, patchVideo, pending],
  );

  const save = useCallback(
    async (video: Video) => {
      const key = `save-${video.id}`;
      if (pending[key]) return;
      const optimistic = !video.saved;
      patchVideo(video.id, {
        saved: optimistic,
        saves_count: Math.max(0, video.saves_count + (optimistic ? 1 : -1)),
      });
      setPending((state) => ({ ...state, [key]: true }));
      try {
        const data = await act<SocialToggle>(`/api/videos/${video.id}/save`);
        if (data) {
          patchVideo(video.id, { saved: data.saved ?? optimistic, saves_count: data.saves_count ?? video.saves_count });
        } else {
          patchVideo(video.id, { saved: video.saved, saves_count: video.saves_count });
        }
      } catch {
        patchVideo(video.id, { saved: video.saved, saves_count: video.saves_count });
      } finally {
        setPending((state) => ({ ...state, [key]: false }));
      }
    },
    [act, patchVideo, pending],
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

  const fetchFeedPage = useCallback(async (feedTab: HomeTabId, cursor: string | null): Promise<FeedPage> => {
    const response = await fetch(feedQuery(feedTab, cursor));
    if (!response.ok) throw new Error('Feed request failed.');
    return response.json() as Promise<FeedPage>;
  }, []);

  const changeTab = useCallback(
    async (nextTab: HomeTabId) => {
      if (nextTab === tab && !error) return;
      const id = ++requestId.current;
      setTab(nextTab);
      setError(false);
      const cached = feedCache.current.get(nextTab);
      if (cached) {
        setVideos(cached.videos);
        setNextCursor(cached.nextCursor);
        return;
      }

      setLoading(true);
      setVideos([]);
      setNextCursor(null);
      try {
        const page = await fetchFeedPage(nextTab, null);
        if (id !== requestId.current) return;
        feedCache.current.set(nextTab, page);
        setVideos(page.videos);
        setNextCursor(page.nextCursor);
      } catch {
        if (id === requestId.current) setError(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [error, fetchFeedPage, tab],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading || loadingMoreRef.current) return;
    const id = requestId.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(false);
    try {
      const page = await fetchFeedPage(tab, nextCursor);
      if (id !== requestId.current) return;
      setVideos((items) => {
        const known = new Set(items.map((item) => item.id));
        const merged = [...items, ...page.videos.filter((item) => !known.has(item.id))];
        feedCache.current.set(tab, { videos: merged, nextCursor: page.nextCursor });
        return merged;
      });
      setNextCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchFeedPage, loading, nextCursor, tab]);

  useEffect(() => {
    if (!loading && !error) {
      feedCache.current.set(tab, { videos, nextCursor });
    }
  }, [error, loading, tab, nextCursor, videos]);

  function addTab(category: VideoCategory) {
    writeCustomTabs(addCustomTab(customTabs, category));
  }

  function removeTab(category: VideoCategory) {
    writeCustomTabs(removeCustomTab(customTabs, category));
    if (tab === category) void changeTab('foryou');
  }

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
    : tab === 'following'
      ? user
        ? 'Follow creators to see their posts here.'
        : 'Sign in and follow creators to see their posts here.'
      : 'Nothing here yet.';

  return (
    <div className="t-home">
      <FeedTabs
        active={tab}
        customTabs={customTabs}
        onSelect={(nextTab) => void changeTab(nextTab)}
        onAddTab={addTab}
        onRemoveTab={removeTab}
      />

      <TimelineFeed
        videos={list}
        user={user}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        nextCursor={nextCursor}
        emptyMessage={emptyMessage}
        onLoadMore={() => void loadMore()}
        onRetry={() => void (videos.length ? loadMore() : changeTab(tab))}
        onLike={(video) => void like(video)}
        onSave={(video) => void save(video)}
        onShare={(video) => void share(video)}
        onNeedAuth={needAuth}
      />

      <AnimatePresence>
        {authMode && (
          <AuthModal mode={authMode} nextPath="/" onClose={() => setAuthMode(null)} onModeChange={setAuthMode} />
        )}
      </AnimatePresence>
    </div>
  );
}
