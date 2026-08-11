'use client';

import type { KeyboardEvent, MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react';
import { useEffect } from 'react';
import type { AppUser, Video } from '@/lib/types';
import { postHeadline } from '@/lib/post-text';
import { fmtLikes, fmtRelativeTime, initials, profileHref } from '../media';
import { useMediaPreview } from '../shell/MediaPreviewContext';
import MediaCarousel from './MediaCarousel';

export interface TimelinePostProps {
  video: Video;
  user: AppUser | null;
  playlist?: Video[];
  onLike: (video: Video) => void;
  onSave: (video: Video) => void;
  onShare: (video: Video) => void;
  onNeedAuth: () => void;
}

export default function TimelinePost({
  video,
  user,
  playlist,
  onLike,
  onSave,
  onShare,
  onNeedAuth,
}: TimelinePostProps) {
  const router = useRouter();
  const href = `/videos/${video.id}`;
  const profile = profileHref(video.author_handle);
  const { openPreview } = useMediaPreview();
  const assets = video.assets ?? [];
  const headline = postHeadline(video);

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  function withAuth(action: (video: Video) => void) {
    return () => (user ? action(video) : onNeedAuth());
  }

  function openPost(event: MouseEvent | KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button, [data-no-nav]')) return;
    router.push(href);
  }

  return (
    <article
      className="t-post"
      role="link"
      tabIndex={0}
      onClick={openPost}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPost(event);
        }
      }}
    >
      <Link
        className="t-av"
        href={profile || href}
        style={{ background: video.author_color }}
        aria-label={video.author_name}
        onClick={(event) => event.stopPropagation()}
      >
        {initials(video.author_name)}
      </Link>

      <div className="t-body">
        <header className="t-head">
          <Link
            href={profile || href}
            className="t-name"
            onClick={(event) => event.stopPropagation()}
          >
            {video.author_name}
          </Link>
          {video.author_handle && <span className="t-handle">{video.author_handle}</span>}
          <span className="t-dot" aria-hidden="true">·</span>
          <time className="t-time" dateTime={video.created_at}>
            {fmtRelativeTime(video.created_at)}
          </time>
        </header>

        <div className="t-text">
          {video.title?.trim() ? <b>{video.title.trim()}</b> : null}
          {video.description && <p>{video.description}</p>}
        </div>

        {assets.length > 0 && (
          <div data-no-nav onClick={(event) => event.stopPropagation()}>
            <MediaCarousel
              video={video}
              className="t-media-wrap"
              onOpen={() => openPreview({ video, playlist })}
            />
          </div>
        )}

        <div className="t-actions" data-no-nav onClick={(event) => event.stopPropagation()}>
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
          <button type="button" onClick={() => onShare(video)} aria-label={`Share ${headline}`}>
            <Share2 aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
