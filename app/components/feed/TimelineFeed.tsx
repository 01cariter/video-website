'use client';

import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { AppUser, Video } from '@/lib/types';
import FeedSkeleton from './FeedSkeleton';
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
    return <FeedSkeleton />;
  }

  return (
    <div className="t-feed">
      {videos.map((video) => (
        <TimelinePost
          key={video.id}
          video={video}
          user={user}
          playlist={videos}
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
