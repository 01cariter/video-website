'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react';
import type { AppUser, Comment, Video } from '@/lib/types';
import { avatarStyle, fmtDate, fmtLikes, fmtRelativeTime, initials, profileHref } from '../media';
import { useMediaPreview } from '../shell/MediaPreviewContext';
import DeleteMenu from './DeleteMenu';
import ShareMenu from './ShareMenu';
import MediaCarousel from './MediaCarousel';

interface PostDetailProps {
  video: Video;
  user: AppUser | null;
  comments: Comment[];
  commentsLoading: boolean;
  commentsError: boolean;
  draft: string;
  posting: boolean;
  onLike: () => void;
  onSave: () => void;
  onFollow: () => void;
  onDeletePost: () => Promise<void>;
  onDeleteComment: (comment: Comment) => Promise<void>;
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
  onLike,
  onSave,
  onFollow,
  onDeletePost,
  onDeleteComment,
  onDraftChange,
  onComment,
  onRetryComments,
  onNeedAuth,
}: PostDetailProps) {
  const router = useRouter();
  const profile = profileHref(video.author_handle);
  const isOwner = user?.id === video.author_id;
  const { openPreview } = useMediaPreview();

  return (
    <article className="pd">
      <header className="pd-top">
        <button type="button" className="pd-back" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft aria-hidden="true" />
        </button>
        <h1>Post</h1>
        <div className="pd-top-author">
          <Link
            className="pd-top-av"
            href={profile || `/videos/${video.id}`}
            style={avatarStyle(video.author_color, video.author_avatar)}
            aria-label={video.author_name}
          >
            {initials(video.author_name)}
          </Link>
          <Link href={profile || `/videos/${video.id}`} className="pd-top-who">
            <b className="t-name">{video.author_name}</b>
            {video.author_handle && <span className="t-handle">{video.author_handle}</span>}
          </Link>
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
      </header>

      <div className="pd-body">
        {(video.assets?.length ?? 0) > 0 && (
          <MediaCarousel
            video={video}
            className="pd-media-wrap pd-media-lead"
            onOpen={() => openPreview({ video })}
          />
        )}

        {video.title?.trim() ? <h2>{video.title.trim()}</h2> : null}
        <p>{video.description || 'No description yet.'}</p>

        <div className="pd-meta">
          <span>{video.label || (video.category === 'study' ? 'Study' : 'Entertainment')}</span>
          {video.duration ? (
            <span className="tabular-nums">{video.duration}</span>
          ) : null}
          <span>
            <span className="tabular-nums">
              {fmtLikes(video.views_count)}
            </span>{' '}
            views
          </span>
          <time dateTime={video.created_at}>{fmtRelativeTime(video.created_at)}</time>
          <span className="pd-meta-muted">Uploaded {fmtDate(video.created_at)}</span>
        </div>
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
          <span className="tabular-nums">
            {fmtLikes(video.likes_count)}
          </span>
        </button>
        <span className="t-comment">
          <MessageCircle aria-hidden="true" />
          <span className="tabular-nums">
            {fmtLikes(video.comments_count)}
          </span>
        </span>
        <button
          type="button"
          className={video.saved ? 'on' : ''}
          onClick={() => (user ? onSave() : onNeedAuth())}
          aria-pressed={video.saved}
          aria-label="Save"
        >
          <Bookmark aria-hidden="true" />
          <span className="tabular-nums">
            {fmtLikes(video.saves_count)}
          </span>
        </button>
        <ShareMenu video={video} label="Share" />
        {isOwner && (
          <DeleteMenu
            itemLabel="post"
            className="pd-post-menu"
            onDelete={onDeletePost}
          />
        )}
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
          <div className="pd-guest">
            <div className="pd-guest-copy">
              <b>Join the conversation</b>
              <p>Sign in to reply and follow creators.</p>
            </div>
            <button type="button" className="pd-guest-cta" onClick={onNeedAuth}>
              Sign in
            </button>
          </div>
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
              <span className="t-av" style={avatarStyle(comment.author_color, comment.author_avatar)}>
                {initials(comment.author_name)}
              </span>
              <div className="pd-comment-body">
                <header>
                  <b>{comment.author_name}</b>
                  {comment.author_handle && <span className="t-handle">{comment.author_handle}</span>}
                  <time dateTime={comment.created_at}>{fmtRelativeTime(comment.created_at)}</time>
                </header>
                <p>{comment.body}</p>
              </div>
              {user?.id === comment.user_id && (
                <DeleteMenu
                  itemLabel="comment"
                  className="pd-comment-menu"
                  onDelete={() => onDeleteComment(comment)}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
