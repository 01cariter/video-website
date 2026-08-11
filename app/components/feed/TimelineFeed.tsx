'use client';

import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { AppUser, Video } from '@/lib/types';
import TimelinePost from './TimelinePost';

export interface TimelineFeedProps {
  videos: Video[];
  user: AppUser | null;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  nextCursor: string | null;
  emptyMessage?: string;
  onLoadMore: () => void;
  onRetry: () => void;
  onLike: (video: Video) => void;
  onSave: (video: Video) => void;
  onShare: (video: Video) => void;
  onNeedAuth: () => void;
}

export default function TimelineFeed({
  videos,
  user,
  loading,
  loadingMore,
  error,
  nextCursor,
  emptyMessage = 'Nothing here yet.',
  onLoadMore,
  onRetry,
  onLike,
  onSave,
  onShare,
  onNeedAuth,
}: TimelineFeedProps) {
  const loadMoreTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = loadMoreTarget.current;
    if (!target || !nextCursor || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '640px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, nextCursor, onLoadMore]);

  if (loading) {
    return (
      <div className="t-feed" role="status" aria-label="Loading posts">
        <span className="sr-only">Loading posts</span>
        {Array.from({ length: 4 }, (_, index) => (
          <div className="t-skeleton" key={index}>
            <i className="t-skeleton-av" />
            <div className="t-skeleton-body">
              <i className="t-skeleton-line" style={{ width: '40%' }} />
              <i className="t-skeleton-line" style={{ width: '85%' }} />
              <i className="t-skeleton-media" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="t-feed">
      {videos.map((video) => (
        <TimelinePost
          key={video.id}
          video={video}
          user={user}
          onLike={onLike}
          onSave={onSave}
          onShare={onShare}
          onNeedAuth={onNeedAuth}
        />
      ))}

      {videos.length === 0 && !error && (
        <div className="empty">
          <Search aria-hidden="true" />
          <p>{emptyMessage}</p>
        </div>
      )}

      {error && (
        <div className="feed-error" role="alert">
          <p>The feed could not load.</p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {!error && (
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
  );
}
