'use client';

import { useT } from '../i18n-provider';
import FeedSkeleton from './FeedSkeleton';

/** Instant main-column placeholder while a route's RSC payload loads. */
export default function RouteSkeleton({
  rows = 4,
  withTabs = false,
}: {
  rows?: number;
  withTabs?: boolean;
}) {
  const t = useT();
  return (
    <div className="t-home route-skeleton" role="status" aria-label={t('common.loading')}>
      <span className="sr-only">{t('common.loading')}</span>
      {withTabs && (
        <div className="t-tabs t-tabs-skel" aria-hidden="true">
          <i className="t-tab-skel" style={{ width: 72 }} />
          <i className="t-tab-skel" style={{ width: 88 }} />
          <i className="t-tab-skel" style={{ width: 64 }} />
        </div>
      )}
      <FeedSkeleton rows={rows} />
    </div>
  );
}
