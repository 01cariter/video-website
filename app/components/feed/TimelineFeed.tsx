'use client';

import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { AppUser, Video } from '@/lib/types';
import FeedSkeleton from './FeedSkeleton';
import TimelinePost from './TimelinePost';
import { useT } from '../i18n-provider';

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
  onDelete?: (video: Video) => Promise<void>;
  onNeedAuth: () => void;
}

export default function TimelineFeed({
  videos,
  user,
  loading,
  loadingMore,
  error,
  nextCursor,
  emptyMessage,
  onLoadMore,
  onRetry,
  onLike,
  onSave,
  onDelete,
  onNeedAuth,
}: TimelineFeedProps) {
  const loadMoreTarget = useRef<HTMLDivElement>(null);
  const t = useT();

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
          onDelete={onDelete}
          onNeedAuth={onNeedAuth}
        />
      ))}

      {videos.length === 0 && !error && (
        <div className="empty">
          <Search aria-hidden="true" />
          <p>{emptyMessage ?? t('feed.empty')}</p>
        </div>
      )}

      {error && (
        <div className="feed-error" role="alert">
          <p>{t('feed.error')}</p>
          <button type="button" onClick={onRetry}>
            {t('common.retry')}
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
