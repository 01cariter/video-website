import { getCurrentUser } from '@/lib/user';
import { getFeedPage } from '@/lib/videos';
import SimpleTimeline from '../../components/feed/SimpleTimeline';

// The feed + signed-in state depend on cookies, so render per-request.
export const dynamic = 'force-dynamic';

export default async function FollowingPage() {
  const user = await getCurrentUser();
  const page = user
    ? await getFeedPage({ filter: { kind: 'following' }, userId: user.id })
    : { videos: [], nextCursor: null };

  return (
    <SimpleTimeline
      user={user}
      source="following"
      initialVideos={page.videos}
      initialNextCursor={page.nextCursor}
    />
  );
}
