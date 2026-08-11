'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { AppUser, Comment, SocialToggle, Video } from '@/lib/types';
import MediaPreview from '../MediaPreview';

interface OpenPreviewOptions {
  video: Video;
  playlist?: Video[];
}

interface MediaPreviewContextValue {
  openPreview: (options: OpenPreviewOptions) => void;
  closePreview: () => void;
}

const MediaPreviewContext = createContext<MediaPreviewContextValue>({
  openPreview: () => {},
  closePreview: () => {},
});

export function useMediaPreview() {
  return useContext(MediaPreviewContext);
}

interface MediaPreviewProviderProps {
  user: AppUser | null;
  onNeedAuth: () => void;
  children: ReactNode;
}

interface CommentsResponse {
  comments?: Comment[];
}

interface CommentResponse {
  comment: Comment;
  comments_count: number;
}

export function MediaPreviewProvider({ user, onNeedAuth, children }: MediaPreviewProviderProps) {
  const [playlist, setPlaylist] = useState<Video[]>([]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [sharedId, setSharedId] = useState<number | null>(null);
  const pending = useRef(new Set<string>());
  const commentsCache = useRef(new Map<number, Comment[]>());
  const viewedIds = useRef(new Set<number>());
  const open = playlist.length > 0;
  const video = open ? playlist[index] : null;
  const videoId = video?.id ?? null;

  const closePreview = useCallback(() => {
    setPlaylist([]);
    setIndex(0);
    setDirection(0);
    setDraft('');
  }, []);

  const openPreview = useCallback(({ video: next, playlist: list }: OpenPreviewOptions) => {
    const hasMedia = (item: Video) =>
      (item.assets?.length ?? 0) > 0 || Boolean(item.video_url || item.poster_url);
    if (!hasMedia(next)) return;
    const source = list && list.length > 0 ? list : [next];
    const items = source.filter(hasMedia);
    if (items.length === 0) return;
    const at = Math.max(0, items.findIndex((item) => item.id === next.id));
    setPlaylist(items);
    setIndex(at >= 0 ? at : 0);
    setDirection(0);
    setDraft('');
    setSharedId(null);
  }, []);

  const patchVideo = useCallback((id: number, patch: Partial<Video>) => {
    setPlaylist((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  async function act<T>(url: string, body?: object): Promise<T | null> {
    const response = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401) {
      onNeedAuth();
      return null;
    }
    return response.ok ? (response.json() as Promise<T>) : null;
  }

  const loadComments = useCallback(async (id: number) => {
    const cached = commentsCache.current.get(id);
    if (cached) {
      setComments(cached);
      setCommentsError(false);
      return;
    }
    setCommentsLoading(true);
    setCommentsError(false);
    try {
      const response = await fetch(`/api/videos/${id}/comments`);
      if (!response.ok) throw new Error('comments failed');
      const data = (await response.json()) as CommentsResponse;
      const next = data.comments || [];
      commentsCache.current.set(id, next);
      setComments(next);
    } catch {
      setComments([]);
      setCommentsError(true);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (videoId == null) return;
    void loadComments(videoId);
  }, [loadComments, videoId]);

  // Depend on videoId only — patching views_count must not re-fire this effect.
  useEffect(() => {
    if (videoId == null) return;
    if (viewedIds.current.has(videoId)) return;
    viewedIds.current.add(videoId);
    const id = videoId;
    void fetch(`/api/videos/${id}/view`, { method: 'POST' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { views_count?: number } | null) => {
        if (typeof data?.views_count === 'number') {
          patchVideo(id, { views_count: data.views_count });
        }
      })
      .catch(() => {});
  }, [patchVideo, videoId]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const playlistRef = useRef(playlist);
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  const go = useCallback((delta: number) => {
    setIndex((current) => {
      const next = current + delta;
      if (next < 0 || next >= playlistRef.current.length) return current;
      setDirection(delta);
      setDraft('');
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closePreview();
      if (event.key === 'ArrowDown') go(1);
      if (event.key === 'ArrowUp') go(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePreview, go, open]);

  async function like(target: Video) {
    if (!user) return onNeedAuth();
    if (pending.current.has(`like-${target.id}`)) return;
    pending.current.add(`like-${target.id}`);
    const optimistic = !target.liked;
    patchVideo(target.id, {
      liked: optimistic,
      likes_count: Math.max(0, target.likes_count + (optimistic ? 1 : -1)),
    });
    try {
      const data = await act<SocialToggle>(`/api/videos/${target.id}/like`);
      if (!data) {
        patchVideo(target.id, { liked: target.liked, likes_count: target.likes_count });
        return;
      }
      patchVideo(target.id, {
        liked: data.liked ?? optimistic,
        likes_count: data.likes_count ?? target.likes_count,
      });
    } catch {
      patchVideo(target.id, { liked: target.liked, likes_count: target.likes_count });
    } finally {
      pending.current.delete(`like-${target.id}`);
    }
  }

  async function save(target: Video) {
    if (!user) return onNeedAuth();
    if (pending.current.has(`save-${target.id}`)) return;
    pending.current.add(`save-${target.id}`);
    const optimistic = !target.saved;
    patchVideo(target.id, {
      saved: optimistic,
      saves_count: Math.max(0, target.saves_count + (optimistic ? 1 : -1)),
    });
    try {
      const data = await act<SocialToggle>(`/api/videos/${target.id}/save`);
      if (!data) {
        patchVideo(target.id, { saved: target.saved, saves_count: target.saves_count });
        return;
      }
      patchVideo(target.id, {
        saved: data.saved ?? optimistic,
        saves_count: data.saves_count ?? target.saves_count,
      });
    } catch {
      patchVideo(target.id, { saved: target.saved, saves_count: target.saves_count });
    } finally {
      pending.current.delete(`save-${target.id}`);
    }
  }

  async function follow(target: Video) {
    if (!user) return onNeedAuth();
    if (pending.current.has(`follow-${target.author_id}`)) return;
    pending.current.add(`follow-${target.author_id}`);
    const optimistic = !target.following;
    setPlaylist((items) =>
      items.map((item) =>
        item.author_id === target.author_id
          ? {
              ...item,
              following: optimistic,
              author_followers: Math.max(0, item.author_followers + (optimistic ? 1 : -1)),
            }
          : item,
      ),
    );
    try {
      const data = await act<SocialToggle>(`/api/authors/${encodeURIComponent(target.author_id)}/follow`);
      if (!data) {
        setPlaylist((items) =>
          items.map((item) =>
            item.author_id === target.author_id
              ? { ...item, following: target.following, author_followers: target.author_followers }
              : item,
          ),
        );
        return;
      }
      setPlaylist((items) =>
        items.map((item) =>
          item.author_id === target.author_id
            ? {
                ...item,
                following: data.following ?? optimistic,
                author_followers: data.followers_count ?? item.author_followers,
              }
            : item,
        ),
      );
    } catch {
      setPlaylist((items) =>
        items.map((item) =>
          item.author_id === target.author_id
            ? { ...item, following: target.following, author_followers: target.author_followers }
            : item,
        ),
      );
    } finally {
      pending.current.delete(`follow-${target.author_id}`);
    }
  }

  async function share(target: Video) {
    const url = `${window.location.origin}/videos/${target.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: target.title || target.description || 'Snackd',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setSharedId(target.id);
      window.setTimeout(() => setSharedId((id) => (id === target.id ? null : id)), 1600);
    } catch {
      /* user cancelled share */
    }
  }

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!video || !user) return onNeedAuth();
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const data = await act<CommentResponse>(`/api/videos/${video.id}/comments`, { body });
      if (!data?.comment) return;
      const next = [...comments, data.comment];
      setComments(next);
      commentsCache.current.set(video.id, next);
      patchVideo(video.id, { comments_count: data.comments_count });
      setDraft('');
    } finally {
      setPosting(false);
    }
  }

  const value = useMemo(() => ({ openPreview, closePreview }), [closePreview, openPreview]);

  return (
    <MediaPreviewContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {video && (
          <motion.div
            key={video.id}
            className="pv-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <MediaPreview
              video={video}
              user={user}
              index={index}
              total={playlist.length}
              direction={direction}
              comments={comments}
              commentsLoading={commentsLoading}
              commentsError={commentsError}
              draft={draft}
              posting={posting}
              shared={sharedId === video.id}
              onClose={closePreview}
              onNavigate={go}
              onLike={(item) => void like(item)}
              onSave={(item) => void save(item)}
              onFollow={(item) => void follow(item)}
              onShare={(item) => void share(item)}
              onDraftChange={setDraft}
              onComment={(event) => void postComment(event)}
              onRetryComments={() => void loadComments(video.id)}
              onNeedAuth={onNeedAuth}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </MediaPreviewContext.Provider>
  );
}
