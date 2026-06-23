import { getCurrentUser } from '@/lib/user';
import { getFeed } from '@/lib/videos';
import HomeFeed from './components/HomeFeed';

// The feed + signed-in state depend on cookies, so render per-request.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  const videos = await getFeed({ category: null, userId: user?.id ?? null });
  return <HomeFeed user={user} initialVideos={videos} />;
}
