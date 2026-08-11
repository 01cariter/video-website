'use client';

import Link from 'next/link';
import { Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react';
import type { AppUser, Video } from '@/lib/types';
import { bg, fmtLikes, fmtRelativeTime, initials, profileHref } from '../media';

export interface TimelinePostProps {
  video: Video;
  user: AppUser | null;
  onLike: (video: Video) => void;
  onSave: (video: Video) => void;
  onShare: (video: Video) => void;
  onNeedAuth: () => void;
}

export default function TimelinePost({ video, user, onLike, onSave, onShare, onNeedAuth }: TimelinePostProps) {
  const href = `/videos/${video.id}`;
  const profile = profileHref(video.author_handle);

  function withAuth(action: (video: Video) => void) {
    return () => (user ? action(video) : onNeedAuth());
  }

  return (
    <article className="t-post">
      <Link
        className="t-av"
        href={profile || href}
        style={{ background: video.author_color }}
        aria-label={video.author_name}
      >
        {initials(video.author_name)}
      </Link>

      <div className="t-body">
        <header className="t-head">
          <Link href={profile || href} className="t-name">
            {video.author_name}
          </Link>
          {video.author_handle && <span className="t-handle">{video.author_handle}</span>}
          <span className="t-dot" aria-hidden="true">·</span>
          <time className="t-time" dateTime={video.created_at}>
            {fmtRelativeTime(video.created_at)}
          </time>
        </header>

        <Link href={href} className="t-text">
          <b>{video.title}</b>
          {video.description && <p>{video.description}</p>}
        </Link>

        <Link
          href={href}
          className="t-media"
          style={{ background: bg(video.poster_url, video.category, video.id) }}
          aria-label={`Open ${video.title}`}
        />

        <div className="t-actions">
          <button
            type="button"
            className={video.liked ? 'on' : ''}
            onClick={withAuth(onLike)}
            aria-pressed={video.liked}
            aria-label="Like"
          >
            <Heart aria-hidden="true" />
            <span>{fmtLikes(video.likes_count)}</span>
          </button>
          <Link href={href} className="t-comment" aria-label="Comments">
            <MessageCircle aria-hidden="true" />
            <span>{fmtLikes(video.comments_count)}</span>
          </Link>
          <button
            type="button"
            className={video.saved ? 'on' : ''}
            onClick={withAuth(onSave)}
            aria-pressed={video.saved}
            aria-label="Save"
          >
            <Bookmark aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onShare(video)} aria-label="Share">
            <Share2 aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
