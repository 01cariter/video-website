import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/user';
import { getFeedPage } from '@/lib/videos';
import HomeTimeline from '../components/feed/HomeTimeline';

// The feed + signed-in state depend on cookies, so render per-request.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  const page = await getFeedPage({ filter: { kind: 'foryou' }, userId: user?.id ?? null });

  return (
    <Suspense fallback={<div className="t-feed" aria-busy="true" />}>
      <HomeTimeline user={user} initialVideos={page.videos} initialNextCursor={page.nextCursor} />
    </Suspense>
  );
}
