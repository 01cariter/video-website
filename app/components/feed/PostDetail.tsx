'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react';
import type { AppUser, Comment, Video } from '@/lib/types';
import { bg, fmtDate, fmtLikes, fmtRelativeTime, initials, profileHref } from '../media';

interface PostDetailProps {
  video: Video;
  user: AppUser | null;
  comments: Comment[];
  commentsLoading: boolean;
  commentsError: boolean;
  draft: string;
  posting: boolean;
  shared: boolean;
  onLike: () => void;
  onSave: () => void;
  onFollow: () => void;
  onShare: () => void;
  onDraftChange: (value: string) => void;
  onComment: (event: FormEvent<HTMLFormElement>) => void;
  onRetryComments: () => void;
  onNeedAuth: () => void;
}

export default function PostDetail({
  video,
  user,
  comments,
  commentsLoading,
  commentsError,
  draft,
  posting,
  shared,
  onLike,
  onSave,
  onFollow,
  onShare,
  onDraftChange,
  onComment,
  onRetryComments,
  onNeedAuth,
}: PostDetailProps) {
  const router = useRouter();
  const profile = profileHref(video.author_handle);
  const isOwner = user?.id === video.author_id;

  return (
    <article className="pd">
      <header className="pd-top">
        <button type="button" className="pd-back" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft aria-hidden="true" />
        </button>
        <h1>Post</h1>
      </header>

      <div className="pd-author">
        <Link
          className="t-av"
          href={profile || `/videos/${video.id}`}
          style={{ background: video.author_color }}
          aria-label={video.author_name}
        >
          {initials(video.author_name)}
        </Link>
        <div className="pd-who">
          <Link href={profile || `/videos/${video.id}`} className="t-name">
            {video.author_name}
          </Link>
          {video.author_handle && <span className="t-handle">{video.author_handle}</span>}
          <small>
            {fmtLikes(video.author_followers)} followers · {fmtRelativeTime(video.created_at)}
          </small>
        </div>
        {!isOwner && (
          <button
            type="button"
            className={`pd-follow ${video.following ? 'on' : ''}`}
            onClick={() => (user ? onFollow() : onNeedAuth())}
          >
            {video.following ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      <div className="pd-body">
        <h2>{video.title}</h2>
        <p>{video.description || 'No description yet.'}</p>
        <div className="pd-meta">
          <span>{video.label || (video.category === 'study' ? 'Study' : 'Entertainment')}</span>
          <span>{video.duration}</span>
          <span>{fmtLikes(video.views_count)} views</span>
          <span>Uploaded {fmtDate(video.created_at)}</span>
        </div>
      </div>

      <div className="pd-media" style={{ background: bg(video.poster_url, video.category, video.id) }}>
        {video.video_url ? (
          <video
            src={video.video_url}
            poster={video.poster_url || undefined}
            controls
            playsInline
            preload="metadata"
          />
        ) : null}
      </div>

      <div className="t-actions pd-actions">
        <button
          type="button"
          className={video.liked ? 'on' : ''}
          onClick={() => (user ? onLike() : onNeedAuth())}
          aria-pressed={video.liked}
          aria-label="Like"
        >
          <Heart aria-hidden="true" />
          <span>{fmtLikes(video.likes_count)}</span>
        </button>
        <span className="t-comment">
          <MessageCircle aria-hidden="true" />
          <span>{fmtLikes(video.comments_count)}</span>
        </span>
        <button
          type="button"
          className={video.saved ? 'on' : ''}
          onClick={() => (user ? onSave() : onNeedAuth())}
          aria-pressed={video.saved}
          aria-label="Save"
        >
          <Bookmark aria-hidden="true" />
          <span>{fmtLikes(video.saves_count)}</span>
        </button>
        <button type="button" onClick={onShare} aria-label="Share">
          <Share2 aria-hidden="true" />
          <span>{shared ? 'Copied' : 'Share'}</span>
        </button>
      </div>

      <section className="pd-comments" aria-label="Comments">
        <h3>Comments</h3>
        {user ? (
          <form className="pd-compose" onSubmit={onComment}>
            <input
              type="text"
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Post your reply"
              maxLength={500}
              disabled={posting}
            />
            <button type="submit" disabled={posting || !draft.trim()}>
              Reply
            </button>
          </form>
        ) : (
          <p className="pd-signin">
            <button type="button" onClick={onNeedAuth}>
              Sign in
            </button>{' '}
            to reply.
          </p>
        )}

        {commentsLoading && <p className="pd-muted">Loading comments…</p>}
        {commentsError && (
          <p className="pd-muted">
            Comments could not load.{' '}
            <button type="button" onClick={onRetryComments}>
              Retry
            </button>
          </p>
        )}
        {!commentsLoading && !commentsError && comments.length === 0 && (
          <p className="pd-muted">No comments yet.</p>
        )}
        <ul className="pd-comment-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <span className="t-av" style={{ background: comment.author_color }}>
                {initials(comment.author_name)}
              </span>
              <div>
                <header>
                  <b>{comment.author_name}</b>
                  {comment.author_handle && <span className="t-handle">{comment.author_handle}</span>}
                  <time dateTime={comment.created_at}>{fmtRelativeTime(comment.created_at)}</time>
                </header>
                <p>{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
