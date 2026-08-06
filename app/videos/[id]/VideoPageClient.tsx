'use client';

import { useCallback, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import type { AppUser, Comment, SocialToggle, Video } from '@/lib/types';
import AuthModal from '@/app/components/AuthModal';
import VideoViewer from '@/app/components/VideoViewer';

interface VideoPageClientProps {
  user: AppUser | null;
  initialVideo: Video;
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

export default function VideoPageClient({
  user,
  initialVideo,
  initialComments,
  initialCommentsError,
}: VideoPageClientProps) {
  const router = useRouter();
  const [video, setVideo] = useState(initialVideo);
  const [comments, setComments] = useState(initialComments);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(initialCommentsError);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [shared, setShared] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const pending = useRef(new Set<string>());

  const needAuth = useCallback(() => setAuthMode('login'), []);

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
    if (!user) return needAuth();
    if (pending.current.has('like')) return;
    pending.current.add('like');
    const previous = video;
    const optimistic = !video.liked;
    setVideo((current) => ({
      ...current,
      liked: optimistic,
      likes_count: Math.max(0, current.likes_count + (optimistic ? 1 : -1)),
    }));
    try {
      const result = await act<SocialToggle>(`/api/videos/${video.id}/like`);
      if (!result) throw new Error('Like failed.');
      setVideo((current) => ({
        ...current,
        liked: result.liked ?? optimistic,
        likes_count: result.likes_count ?? current.likes_count,
      }));
    } catch {
      setVideo((current) => ({
        ...current,
        liked: previous.liked,
        likes_count: previous.likes_count,
      }));
    } finally {
      pending.current.delete('like');
    }
  }

  async function save() {
    if (!user) return needAuth();
    if (pending.current.has('save')) return;
    pending.current.add('save');
    const previous = video;
    const optimistic = !video.saved;
    setVideo((current) => ({
      ...current,
      saved: optimistic,
      saves_count: Math.max(0, current.saves_count + (optimistic ? 1 : -1)),
    }));
    try {
      const result = await act<SocialToggle>(`/api/videos/${video.id}/save`);
      if (!result) throw new Error('Save failed.');
      setVideo((current) => ({
        ...current,
        saved: result.saved ?? optimistic,
        saves_count: result.saves_count ?? current.saves_count,
      }));
    } catch {
      setVideo((current) => ({
        ...current,
        saved: previous.saved,
        saves_count: previous.saves_count,
      }));
    } finally {
      pending.current.delete('save');
    }
  }

  async function follow() {
    if (!user) return needAuth();
    if (pending.current.has('follow')) return;
    pending.current.add('follow');
    const previous = video;
    const optimistic = !video.following;
    setVideo((current) => ({
      ...current,
      following: optimistic,
      author_followers: Math.max(0, current.author_followers + (optimistic ? 1 : -1)),
    }));
    try {
      const result = await act<SocialToggle>(`/api/authors/${encodeURIComponent(video.author_id)}/follow`);
      if (!result) throw new Error('Follow failed.');
      setVideo((current) => ({
        ...current,
        following: result.following ?? optimistic,
        author_followers: result.followers_count ?? current.author_followers,
      }));
    } catch {
      setVideo((current) => ({
        ...current,
        following: previous.following,
        author_followers: previous.author_followers,
      }));
    } finally {
      pending.current.delete('follow');
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, text: video.description || undefined, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    } catch {
      // Native share sheets reject when cancelled.
    }
  }

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return needAuth();
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const result = await act<CommentResponse>(`/api/videos/${video.id}/comments`, { body });
      if (result) {
        setComments((items) => [result.comment, ...items]);
        setVideo((current) => ({ ...current, comments_count: result.comments_count }));
        setDraft('');
      }
    } finally {
      setPosting(false);
    }
  }

  async function retryComments() {
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

  return (
    <>
      <VideoViewer
        standalone
        video={video}
        user={user}
        index={0}
        total={1}
        direction={0}
        comments={comments}
        commentsLoading={commentsLoading}
        commentsError={commentsError}
        draft={draft}
        posting={posting}
        shared={shared}
        onClose={() => router.push('/')}
        onNavigate={() => undefined}
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
