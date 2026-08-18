import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';
import {
  getProfileByHandle,
  getProfileFollowers,
  getSavedVideos,
  getVideosByAuthor,
} from '@/lib/profiles';
import ProfileClient from './ProfileClient';

export const dynamic = 'force-dynamic';

interface ProfilePageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfileByHandle({ handle });
  if (!profile) return {};

  const description =
    profile.bio || `${profile.display_name} posts short-form study and play videos on Snackd.`;
  return {
    title: `${profile.display_name} (${profile.handle}) | Snackd`,
    description,
    alternates: { canonical: `/u/${handle}` },
    openGraph: {
      type: 'profile',
      title: `${profile.display_name} on Snackd`,
      description,
      siteName: 'Snackd',
    },
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const user = await getCurrentUser();
  const profile = await getProfileByHandle({ handle, viewerId: user?.id ?? null });
  if (!profile) notFound();

  const isOwner = user?.id === profile.user_id;
  const [posts, saved, followers] = await Promise.all([
    getVideosByAuthor({ authorId: profile.user_id, viewerId: user?.id ?? null }),
    isOwner ? getSavedVideos({ userId: profile.user_id }) : Promise.resolve([]),
    getProfileFollowers({ authorId: profile.user_id, viewerId: user?.id ?? null }),
  ]);

  return (
    <ProfileClient
      user={user}
      profile={profile}
      posts={posts}
      saved={saved}
      followers={followers}
      isOwner={isOwner}
    />
  );
}
