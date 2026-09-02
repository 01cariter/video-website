'use client';

import { useT } from '../i18n-provider';
/** Shared timeline post placeholders. */
export default function FeedSkeleton({ rows = 4 }: { rows?: number }) {
  const t = useT();
  return (
    <div className="t-feed" role="status" aria-label={t('feed.loadingPosts')}>
      <span className="sr-only">{t('feed.loadingPosts')}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div className="t-skeleton" key={index}>
          <i className="t-skeleton-av" />
          <div className="t-skeleton-body">
            <i className="t-skeleton-line" style={{ width: `${38 + (index % 3) * 10}%` }} />
            <i className="t-skeleton-line" style={{ width: `${72 + (index % 2) * 12}%` }} />
            <i className="t-skeleton-media" />
          </div>
        </div>
      ))}
    </div>
  );
}
