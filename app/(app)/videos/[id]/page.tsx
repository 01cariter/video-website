import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';
import VideoPageClient from './VideoPageClient';

export const dynamic = 'force-dynamic';

interface VideoPageProps {
  params: Promise<{ id: string }>;
}

// Keep metadata cheap — a full getVideoById here blocks every soft navigation.
export async function generateMetadata({ params }: VideoPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: 'Post | Snackd',
    alternates: { canonical: `/videos/${id}` },
  };
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId) || videoId <= 0) notFound();

  // User is per-request cached with the shell layout — no video/comments wait.
  const user = await getCurrentUser();

  return <VideoPageClient key={videoId} user={user} videoId={videoId} />;
}
