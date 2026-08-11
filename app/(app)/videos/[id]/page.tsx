import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';
import { getComments, getVideoById } from '@/lib/videos';
import VideoPageClient from './VideoPageClient';

export const dynamic = 'force-dynamic';

interface VideoPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: VideoPageProps): Promise<Metadata> {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) return {};
  const video = await getVideoById({ id: videoId });
  if (!video) return {};

  const description = video.description || `Watch ${video.title} by ${video.author_name} on Snackd.`;
  return {
    title: `${video.title} | Snackd`,
    description,
    alternates: { canonical: `/videos/${video.id}` },
    openGraph: {
      type: 'video.other',
      url: `/videos/${video.id}`,
      title: video.title,
      description,
      siteName: 'Snackd',
      images: [{ url: `/videos/${video.id}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: video.title,
      description,
      images: [`/videos/${video.id}/opengraph-image`],
    },
  };
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) notFound();

  const user = await getCurrentUser();
  const [video, commentsResult] = await Promise.all([
    getVideoById({ id: videoId, userId: user?.id ?? null }),
    getComments(videoId).then(
      (comments) => ({ comments, error: false }),
      () => ({ comments: [], error: true }),
    ),
  ]);
  if (!video) notFound();

  return (
    <VideoPageClient
      user={user}
      initialVideo={video}
      initialComments={commentsResult.comments}
      initialCommentsError={commentsResult.error}
    />
  );
}
