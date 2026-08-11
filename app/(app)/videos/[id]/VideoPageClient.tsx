'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'motion/react';
import type { AppUser, Comment, SocialToggle, Video } from '@/lib/types';
import AuthModal from '@/app/components/AuthModal';
import PostDetail from '@/app/components/feed/PostDetail';
import PostDetailSkeleton from '@/app/components/feed/PostDetailSkeleton';

interface VideoPageClientProps {
  user: AppUser | null;
  videoId: number;
}

interface DetailResponse {
  video?: Video;
  comments?: Comment[];
  error?: string;
}

interface CommentsResponse {
  comments?: Comment[];
}

interface CommentResponse {
  comment: Comment;
  comments_count: number;
}

export default function VideoPageClient({ user, videoId }: VideoPageClientProps) {
  const [video, setVideo] = useState<Video | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState(false);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [shared, setShared] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const pending = useRef(new Set<string>());
  const viewed = useRef(false);

  const needAuth = useCallback(() => setAuthMode('login'), []);

  useEffect(() => {
    let cancelled = false;

    void fetch(`/api/videos/${videoId}`)
      .then(async (response) => {
        if (response.status === 404) {
          if (!cancelled) setMissing(true);
          return null;
        }
        if (!response.ok) throw new Error('detail failed');
        return response.json() as Promise<DetailResponse>;
      })
      .then((data) => {
        if (cancelled || !data?.video) return;
        setVideo(data.video);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });

    void fetch(`/api/videos/${videoId}/comments`)
      .then(async (response) => {
        if (!response.ok) throw new Error('comments failed');
        return response.json() as Promise<CommentsResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setComments(data.comments || []);
        setCommentsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCommentsError(true);
        setCommentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(() => {
    if (!video || viewed.current) return;
    viewed.current = true;
    const id = video.id;
    void fetch(`/api/videos/${id}/view`, { method: 'POST' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { views_count?: number } | null) => {
        if (typeof data?.views_count === 'number') {
          setVideo((current) => (current ? { ...current, views_count: data.views_count! } : current));
        }
      })
      .catch(() => {});
  }, [video]);

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
    return response.ok ? (response.json() as Promise<T>) : null;
  }

  async function like() {
    if (!video) return;
    if (!user) return needAuth();
    if (pending.current.has('like')) return;
    pending.current.add('like');
    const previous = video;
    const optimistic = !video.liked;
    setVideo({
      ...video,
      liked: optimistic,
      likes_count: Math.max(0, video.likes_count + (optimistic ? 1 : -1)),
    });
    try {
      const result = await act<SocialToggle>(`/api/videos/${video.id}/like`);
      if (!result) throw new Error('Like failed.');
      setVideo((current) =>
        current
          ? {
              ...current,
              liked: result.liked ?? optimistic,
              likes_count: result.likes_count ?? current.likes_count,
            }
          : current,
      );
    } catch {
      setVideo(previous);
    } finally {
      pending.current.delete('like');
    }
  }

  async function save() {
    if (!video) return;
    if (!user) return needAuth();
    if (pending.current.has('save')) return;
    pending.current.add('save');
    const previous = video;
    const optimistic = !video.saved;
    setVideo({
      ...video,
      saved: optimistic,
      saves_count: Math.max(0, video.saves_count + (optimistic ? 1 : -1)),
    });
    try {
      const result = await act<SocialToggle>(`/api/videos/${video.id}/save`);
      if (!result) throw new Error('Save failed.');
      setVideo((current) =>
        current
          ? {
              ...current,
              saved: result.saved ?? optimistic,
              saves_count: result.saves_count ?? current.saves_count,
            }
          : current,
      );
    } catch {
      setVideo(previous);
    } finally {
      pending.current.delete('save');
    }
  }

  async function follow() {
    if (!video) return;
    if (!user) return needAuth();
    if (pending.current.has('follow')) return;
    pending.current.add('follow');
    const previous = video;
    const optimistic = !video.following;
    setVideo({
      ...video,
      following: optimistic,
      author_followers: Math.max(0, video.author_followers + (optimistic ? 1 : -1)),
    });
    try {
      const result = await act<SocialToggle>(
        `/api/authors/${encodeURIComponent(video.author_id)}/follow`,
      );
      if (!result) throw new Error('Follow failed.');
      setVideo((current) =>
        current
          ? {
              ...current,
              following: result.following ?? optimistic,
              author_followers: result.followers_count ?? current.author_followers,
            }
          : current,
      );
    } catch {
      setVideo(previous);
    } finally {
      pending.current.delete('follow');
    }
  }

  async function share() {
    if (!video) return;
    const url = window.location.href;
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
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    } catch {
      // cancelled
    }
  }

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!video) return;
    if (!user) return needAuth();
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const result = await act<CommentResponse>(`/api/videos/${video.id}/comments`, { body });
      if (result) {
        setComments((items) => [result.comment, ...items]);
        setVideo((current) =>
          current ? { ...current, comments_count: result.comments_count } : current,
        );
        setDraft('');
      }
    } finally {
      setPosting(false);
    }
  }

  async function retryComments() {
    if (!video) return;
    setCommentsLoading(true);
    setCommentsError(false);
    try {
      const response = await fetch(`/api/videos/${video.id}/comments`);
      if (!response.ok) throw new Error('Comments request failed.');
      const result = (await response.json()) as CommentsResponse;
      setComments(result.comments || []);
    } catch {
      setCommentsError(true);
    } finally {
      setCommentsLoading(false);
    }
  }

  if (!video) {
    if (missing) {
      return (
        <div className="x-empty">
          <h1>Post not found</h1>
          <p>This post may have been removed.</p>
          <Link href="/">Home</Link>
        </div>
      );
    }
    return <PostDetailSkeleton />;
  }

  return (
    <>
      <PostDetail
        video={video}
        user={user}
        comments={comments}
        commentsLoading={commentsLoading}
        commentsError={commentsError}
        draft={draft}
        posting={posting}
        shared={shared}
        onLike={() => void like()}
        onSave={() => void save()}
        onFollow={() => void follow()}
        onShare={() => void share()}
        onDraftChange={setDraft}
        onComment={postComment}
        onRetryComments={() => void retryComments()}
        onNeedAuth={needAuth}
      />

      <AnimatePresence>
        {authMode && (
          <AuthModal
            mode={authMode}
            nextPath={`/videos/${video.id}`}
            onClose={() => setAuthMode(null)}
            onModeChange={setAuthMode}
          />
        )}
      </AnimatePresence>
    </>
  );
}
