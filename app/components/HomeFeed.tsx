'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Clapperboard, Home, LogIn, LogOut, Moon, Plus, Search, Sun, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { flushSync } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { getSoloUrl } from '@/lib/solo';
import type { AppUser, Comment, FeedMode, FeedPage, SocialToggle, Video } from '@/lib/types';
import AuthModal from './AuthModal';
import CreateModal from './CreateModal';
import { initials, profileHref } from './media';
import VideoCard from './VideoCard';
import VideoViewer from './VideoViewer';

const FEED_COPY: Record<FeedMode, string> = {
  all: 'Your feed',
  study: 'Study',
  play: 'Entertainment',
};

interface HomeFeedProps {
  user: AppUser | null;
  initialVideos: Video[];
  initialNextCursor: string | null;
  initialOpenId: number | null;
  initialComments: Comment[];
  initialCommentsError: boolean;
}

interface CommentsResponse {
  comments?: Comment[];
}

interface CommentResponse {
  comment: Comment;
  comments_count: number;
}

export default function HomeFeed({
  user,
  initialVideos,
  initialNextCursor,
  initialOpenId,
  initialComments,
  initialCommentsError,
}: HomeFeedProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [videos, setVideos] = useState(initialVideos);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [mode, setMode] = useState<FeedMode>('all');
  const [query, setQuery] = useState('');
  const [feedLoading, setFeedLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<number | null>(initialOpenId);
  const [direction, setDirection] = useState(0);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(initialCommentsError);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [sharedId, setSharedId] = useState<number | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const lastNavigationAt = useRef(0);
  const loadMoreTarget = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const feedRequestId = useRef(0);
  const commentsCache = useRef(new Map<number, Comment[]>(
    initialOpenId && !initialCommentsError ? [[initialOpenId, initialComments]] : [],
  ));
  const commentsRequests = useRef(new Map<number, Promise<Comment[]>>());
  const modalVideoId = useRef<number | null>(initialOpenId);
  const closingModal = useRef(false);
  const feedCache = useRef(new Map<FeedMode, FeedPage>([
    ['all', { videos: initialVideos, nextCursor: initialNextCursor }],
  ]));

  const list = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return videos;
    return videos.filter(
      (video) =>
        video.title.toLowerCase().includes(normalizedQuery) ||
        (video.author_handle || '').toLowerCase().includes(normalizedQuery) ||
        video.author_name.toLowerCase().includes(normalizedQuery),
    );
  }, [query, videos]);

  const openIndex = useMemo(() => list.findIndex((video) => video.id === openId), [list, openId]);
  const current = openIndex >= 0 ? list[openIndex] : null;

  const patchVideo = useCallback((id: number, patch: Partial<Video>) => {
    setVideos((items) => items.map((video) => (video.id === id ? { ...video, ...patch } : video)));
  }, []);

  const patchAuthor = useCallback((authorId: string, patch: Partial<Video>) => {
    setVideos((items) =>
      items.map((video) => (video.author_id === authorId ? { ...video, ...patch } : video)),
    );
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    if (isDark) {
      root.removeAttribute('data-theme');
      localStorage.setItem('snackd-theme', 'light');
    } else {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('snackd-theme', 'dark');
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  const needAuth = useCallback(() => {
    setAuthMode('login');
  }, []);

  async function act<T>(url: string, body?: object): Promise<T | null> {
    const response = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401) {
      needAuth();
      return null;
    }
    if (!response.ok) {
      // The optimistic update just rolls back, which looks like nothing
      // happened — the server's reason is the only way to tell why.
      const payload = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
      console.error('[snackd] request rejected', {
        url,
        status: response.status,
        error: payload.error,
        detail: payload.detail,
      });
      return null;
    }
    return response.json() as Promise<T>;
  }

  async function like(video: Video) {
    if (!user) return needAuth();
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
        patchVideo(video.id, {
          liked: data.liked ?? optimistic,
          likes_count: data.likes_count ?? video.likes_count,
        });
      } else {
        patchVideo(video.id, { liked: video.liked, likes_count: video.likes_count });
      }
    } catch {
      patchVideo(video.id, { liked: video.liked, likes_count: video.likes_count });
    } finally {
      setPending((state) => ({ ...state, [key]: false }));
    }
  }

  async function save(video: Video) {
    if (!user) return needAuth();
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
        patchVideo(video.id, {
          saved: data.saved ?? optimistic,
          saves_count: data.saves_count ?? video.saves_count,
        });
      } else {
        patchVideo(video.id, { saved: video.saved, saves_count: video.saves_count });
      }
    } catch {
      patchVideo(video.id, { saved: video.saved, saves_count: video.saves_count });
    } finally {
      setPending((state) => ({ ...state, [key]: false }));
    }
  }

  async function follow(video: Video) {
    if (!user) return needAuth();
    const key = `follow-${video.author_id}`;
    if (pending[key]) return;
    const optimistic = !video.following;
    patchAuthor(video.author_id, {
      following: optimistic,
      author_followers: Math.max(0, video.author_followers + (optimistic ? 1 : -1)),
    });
    setPending((state) => ({ ...state, [key]: true }));
    try {
      const data = await act<SocialToggle>(`/api/authors/${encodeURIComponent(video.author_id)}/follow`);
      if (data) {
        patchAuthor(video.author_id, {
          following: data.following ?? optimistic,
          author_followers: data.followers_count ?? video.author_followers,
        });
      } else {
        patchAuthor(video.author_id, {
          following: video.following,
          author_followers: video.author_followers,
        });
      }
    } catch {
      patchAuthor(video.author_id, {
        following: video.following,
        author_followers: video.author_followers,
      });
    } finally {
      setPending((state) => ({ ...state, [key]: false }));
    }
  }

  async function share(video: Video) {
    const url = `${window.location.origin}/videos/${video.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, text: video.description || undefined, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setSharedId(video.id);
      window.setTimeout(() => setSharedId(null), 1600);
    } catch {
      // Native share sheets reject when the user cancels.
    }
  }

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return needAuth();
    const body = draft.trim();
    if (!body || !current || posting) return;
    setPosting(true);
    try {
      const data = await act<CommentResponse>(`/api/videos/${current.id}/comments`, { body });
      if (data) {
        setComments((items) => {
          const nextComments = [data.comment, ...items];
          commentsCache.current.set(current.id, nextComments);
          return nextComments;
        });
        patchVideo(current.id, { comments_count: data.comments_count });
        setDraft('');
      }
    } finally {
      setPosting(false);
    }
  }

  const fetchComments = useCallback(async (id: number) => {
    const cached = commentsCache.current.get(id);
    if (cached) return cached;
    const pendingRequest = commentsRequests.current.get(id);
    if (pendingRequest) return pendingRequest;

    const request = fetch(`/api/videos/${id}/comments`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Comments request failed.');
        const data = (await response.json()) as CommentsResponse;
        const result = data.comments || [];
        commentsCache.current.set(id, result);
        return result;
      })
      .finally(() => commentsRequests.current.delete(id));
    commentsRequests.current.set(id, request);
    return request;
  }, []);

  const loadComments = useCallback(
    async (id: number) => {
      const cached = commentsCache.current.get(id);
      if (cached) {
        setComments(cached);
        setCommentsLoading(false);
        setCommentsError(false);
        return;
      }
      setCommentsLoading(true);
      setCommentsError(false);
      try {
        setComments(await fetchComments(id));
      } catch {
        setCommentsError(true);
      } finally {
        setCommentsLoading(false);
      }
    },
    [fetchComments],
  );

  function openPreview(video: Video) {
    lastNavigationAt.current = 0;
    flushSync(() => {
      setDirection(0);
      setOpenId(video.id);
      setDraft('');
      setComments(commentsCache.current.get(video.id) || []);
    });
    modalVideoId.current = video.id;
    closingModal.current = false;
    window.history.pushState(
      { ...window.history.state, snackdVideo: true },
      '',
      `/videos/${video.id}`,
    );
    void loadComments(video.id);
  }

  const closePreview = useCallback(() => {
    flushSync(() => setOpenId(null));
    modalVideoId.current = null;
    closingModal.current = true;
    if (window.history.state?.snackdVideo) {
      window.history.back();
    }
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (openIndex < 0) return;
      const now = Date.now();
      if (now - lastNavigationAt.current < 180) return;
      const nextIndex = openIndex + delta;
      if (nextIndex < 0 || nextIndex >= list.length) return;
      lastNavigationAt.current = now;
      const target = list[nextIndex];
      flushSync(() => {
        setDirection(delta);
        setOpenId(target.id);
        setDraft('');
        setComments(commentsCache.current.get(target.id) || []);
      });
      modalVideoId.current = target.id;
      closingModal.current = false;
      window.history.replaceState(
        { ...window.history.state, snackdVideo: true },
        '',
        `/videos/${target.id}`,
      );
      void loadComments(target.id);
    },
    [list, loadComments, openIndex],
  );

  const fetchFeedPage = useCallback(async (feedMode: FeedMode, cursor: string | null) => {
    const search = new URLSearchParams({ limit: '12' });
    if (feedMode !== 'all') search.set('category', feedMode);
    if (cursor) search.set('cursor', cursor);
    const response = await fetch(`/api/videos?${search.toString()}`);
    if (!response.ok) throw new Error('Feed request failed.');
    return response.json() as Promise<FeedPage>;
  }, []);

  async function changeMode(nextMode: FeedMode) {
    if (nextMode === mode && !feedError) return;
    const requestId = ++feedRequestId.current;
    setMode(nextMode);
    setQuery('');
    setFeedError(false);
    const cached = feedCache.current.get(nextMode);
    if (cached) {
      setVideos(cached.videos);
      setNextCursor(cached.nextCursor);
      return;
    }

    setFeedLoading(true);
    setVideos([]);
    setNextCursor(null);
    try {
      const page = await fetchFeedPage(nextMode, null);
      if (requestId !== feedRequestId.current) return;
      feedCache.current.set(nextMode, page);
      setVideos(page.videos);
      setNextCursor(page.nextCursor);
    } catch {
      if (requestId === feedRequestId.current) setFeedError(true);
    } finally {
      if (requestId === feedRequestId.current) setFeedLoading(false);
    }
  }

  // Publishing dismisses the overlay onto the feed the post belongs in, so the
  // post is visible the moment it exists — no navigation, no reload.
  function showPublished(video: Video) {
    setCreateOpen(false);
    // A live search would filter the new post straight back out.
    setQuery('');

    for (const feed of ['all', video.category] as FeedMode[]) {
      const page = feedCache.current.get(feed);
      if (!page) continue;
      feedCache.current.set(feed, {
        videos: [video, ...page.videos.filter((item) => item.id !== video.id)],
        nextCursor: page.nextCursor,
      });
    }

    if (mode === 'all' || mode === video.category) {
      setVideos((items) => [video, ...items.filter((item) => item.id !== video.id)]);
      return;
    }
    // Posted to the other category: follow it, or the post lands off-screen.
    void changeMode(video.category);
  }

  const loadMore = useCallback(async () => {
    if (!nextCursor || feedLoading || loadingMoreRef.current) return;
    const requestId = feedRequestId.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setFeedError(false);
    try {
      const page = await fetchFeedPage(mode, nextCursor);
      if (requestId !== feedRequestId.current) return;
      setVideos((items) => {
        const known = new Set(items.map((item) => item.id));
        const merged = [...items, ...page.videos.filter((item) => !known.has(item.id))];
        feedCache.current.set(mode, { videos: merged, nextCursor: page.nextCursor });
        return merged;
      });
      setNextCursor(page.nextCursor);
    } catch {
      setFeedError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [feedLoading, fetchFeedPage, mode, nextCursor]);

  useEffect(() => {
    if (!feedLoading && !feedError) {
      feedCache.current.set(mode, { videos, nextCursor });
    }
  }, [feedError, feedLoading, mode, nextCursor, videos]);

  useEffect(() => {
    const target = loadMoreTarget.current;
    if (!target || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '640px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  useEffect(() => {
    function syncHistoryNavigation() {
      const match = /^\/videos\/(\d+)$/.exec(window.location.pathname);
      const id = Number(match?.[1]);
      const target = list.find((video) => video.id === id);
      if (closingModal.current) {
        if (!match) closingModal.current = false;
        return;
      }
      if (window.history.state?.snackdVideo && target && modalVideoId.current !== id) {
        modalVideoId.current = id;
        flushSync(() => {
          setDirection(0);
          setOpenId(id);
          setComments(commentsCache.current.get(id) || []);
        });
        void loadComments(id);
      } else if (!match && modalVideoId.current !== null) {
        modalVideoId.current = null;
        flushSync(() => setOpenId(null));
      }
    }
    window.addEventListener('popstate', syncHistoryNavigation, true);
    return () => window.removeEventListener('popstate', syncHistoryNavigation, true);
  }, [list, loadComments]);

  useEffect(() => {
    document.body.style.overflow = openId || authMode || createOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [authMode, createOpen, openId]);

  useEffect(() => {
    // The overlay owns Escape and the arrow keys while it is up.
    if (!current || authMode || createOpen) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') closePreview();
      if (event.key === 'ArrowDown') go(1);
      if (event.key === 'ArrowUp') go(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authMode, closePreview, createOpen, current, go]);

  return (
    <>
      <div className="app">
        <aside className="side">
          <Link className="logo" href="/" aria-label="Snackd home">
            <span className="mark" />
            <span>Snackd</span>
          </Link>

          <nav className="nav" aria-label="Feed categories">
            <button
              type="button"
              className={mode === 'all' ? 'active' : ''}
              onClick={() => void changeMode('all')}
              aria-pressed={mode === 'all'}
            >
              <span className="ic"><Home aria-hidden="true" /></span>
              <span>Home</span>
            </button>
            <button
              type="button"
              className={mode === 'study' ? 'active' : ''}
              onClick={() => void changeMode('study')}
              aria-pressed={mode === 'study'}
            >
              <span className="ic"><BookOpen aria-hidden="true" /></span>
              <span>Study</span>
            </button>
            <button
              type="button"
              className={mode === 'play' ? 'active' : ''}
              onClick={() => void changeMode('play')}
              aria-pressed={mode === 'play'}
            >
              <span className="ic"><Clapperboard aria-hidden="true" /></span>
              <span>Entertainment</span>
            </button>
          </nav>

          {user ? (
            <button type="button" className="create" onClick={() => setCreateOpen(true)}>
              <span className="ic"><Plus aria-hidden="true" /></span>
              <span>Create</span>
            </button>
          ) : (
            <button type="button" className="create" onClick={() => setAuthMode('login')}>
              <span className="ic"><Plus aria-hidden="true" /></span>
              <span>Create</span>
            </button>
          )}

          {user ? (
            <div className="me">
              <Link className="me-link" href={profileHref(user.handle) || '/'} title="Your profile">
                <span className="av" style={{ background: user.avatar_color }}>
                  {initials(user.display_name)}
                </span>
                <span className="txt">
                  <b>{user.display_name}</b>
                  <small>Lvl {user.level} · Streak {user.streak}</small>
                </span>
              </Link>
              <button type="button" className="logout" onClick={logout} title="Sign out" aria-label="Sign out">
                <LogOut aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="guest">
              <button type="button" className="signin" onClick={() => setAuthMode('login')}>Sign in</button>
              <button type="button" className="signup" onClick={() => setAuthMode('register')}>Create account</button>
            </div>
          )}
        </aside>

        <main className="main">
          <div className="topbar">
            <Link className="mobile-logo" href="/" aria-label="Snackd home">
              <span className="mark" />
              <span>Snackd</span>
            </Link>
            <label className="search">
              <Search className="sic" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search shorts, topics, creators..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQuery('')}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </label>
            {!user && (
              <button
                type="button"
                className="mobile-auth"
                onClick={() => setAuthMode('login')}
                title="Sign in"
                aria-label="Sign in"
              >
                <LogIn aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="themeBtn"
              onClick={toggleTheme}
              title="Toggle light or dark theme"
              aria-label="Toggle light or dark theme"
            >
              <Sun className="sun" aria-hidden="true" />
              <Moon className="moon" aria-hidden="true" />
            </button>
          </div>

          <div className="feedwrap">
            <h1>{FEED_COPY[mode]}</h1>

            {feedLoading ? (
              <div className="grid feed-skeleton-grid" role="status" aria-label="Loading videos">
                <span className="sr-only">Loading videos</span>
                {Array.from({ length: 8 }, (_, index) => (
                  <span className={`feed-card-skeleton ${index === 0 ? 'big' : index === 3 ? 'tall' : ''}`} key={index}>
                    <i />
                    <b />
                    <small />
                  </span>
                ))}
              </div>
            ) : (
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
                    onOpen={openPreview}
                    onWarm={(item) => void fetchComments(item.id)}
                  />
                );
              })}
              </div>
            )}

            {!feedLoading && list.length === 0 && !feedError && (
              <div className="empty">
                <Search aria-hidden="true" />
                <p>No shorts match “{query}”.</p>
                <button type="button" onClick={() => setQuery('')}>Clear search</button>
              </div>
            )}

            {!feedLoading && feedError && (
              <div className="feed-error" role="alert">
                <p>The feed could not load.</p>
                <button type="button" onClick={() => void (videos.length ? loadMore() : changeMode(mode))}>
                  Retry
                </button>
              </div>
            )}

            {!feedLoading && (
              <div className="feed-more" ref={loadMoreTarget} aria-hidden={!loadingMore}>
                {loadingMore && (
                  <>
                    <i />
                    <i />
                    <i />
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {current && (
        <VideoViewer
          video={current}
          user={user}
          index={openIndex}
          total={list.length}
          direction={direction}
          comments={comments}
          commentsLoading={commentsLoading}
          commentsError={commentsError}
          draft={draft}
          posting={posting}
          shared={sharedId === current.id}
          onClose={closePreview}
          onNavigate={go}
          onLike={(video) => void like(video)}
          onSave={(video) => void save(video)}
          onFollow={(video) => void follow(video)}
          onShare={(video) => void share(video)}
          onDraftChange={setDraft}
          onComment={postComment}
          onRetryComments={() => void loadComments(current.id)}
          onNeedAuth={needAuth}
        />
      )}

      <AnimatePresence>
        {authMode && (
          <AuthModal
            mode={authMode}
            nextPath={current ? `/videos/${current.id}` : '/'}
            onClose={() => setAuthMode(null)}
            onModeChange={setAuthMode}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createOpen && user && (
          <CreateModal
            user={user}
            soloUrl={getSoloUrl()}
            onClose={() => setCreateOpen(false)}
            onPublished={showPublished}
          />
        )}
      </AnimatePresence>
    </>
  );
}
