import { LogIn } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { getSavedVideos } from '@/lib/profiles';
import SimpleTimeline from '../../components/feed/SimpleTimeline';

// The saved list + signed-in state depend on cookies, so render per-request.
export const dynamic = 'force-dynamic';

export default async function BookmarksPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="t-home">
        <div className="empty">
          <LogIn aria-hidden="true" />
          <p>Sign in to see the posts you have bookmarked.</p>
        </div>
      </div>
    );
  }

  const videos = await getSavedVideos({ userId: user.id });

  return <SimpleTimeline user={user} source="bookmarks" initialVideos={videos} />;
}
