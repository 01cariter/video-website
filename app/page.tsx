import { getCurrentUser } from '@/lib/user';
import { getComments, getFeedPage } from '@/lib/videos';
import HomeFeed from './components/HomeFeed';
import type { Comment, Video } from '@/lib/types';

// The feed + signed-in state depend on cookies, so render per-request.
export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<{ video?: string | string[] }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const page = await getFeedPage({ category: null, userId: user?.id ?? null });
  const videos: Video[] = page.videos;
  const requestedId = Number(Array.isArray(params.video) ? params.video[0] : params.video);
  const initialOpenId = videos.some((video) => video.id === requestedId) ? requestedId : null;
  let initialComments: Comment[] = [];
  let initialCommentsError = false;
  if (initialOpenId) {
    try {
      initialComments = await getComments(initialOpenId);
    } catch {
      initialCommentsError = true;
    }
  }
  return (
    <HomeFeed
      user={user}
      initialVideos={videos}
      initialNextCursor={page.nextCursor}
      initialOpenId={initialOpenId}
      initialComments={initialComments}
      initialCommentsError={initialCommentsError}
    />
  );
}
