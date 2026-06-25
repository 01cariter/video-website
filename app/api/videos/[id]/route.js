import { NextResponse } from 'next/server';
import { getVideoById, getComments } from '@/lib/videos';
import { getCurrentUser } from '@/lib/user';

export const runtime = 'nodejs';

// GET /api/videos/:id — full video detail for the preview (incl. comments).
export async function GET(request, { params }) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  const user = await getCurrentUser();
  const video = await getVideoById({ id: videoId, userId: user?.id ?? null });
  if (!video) {
    return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  }
  const comments = await getComments(videoId);
  return NextResponse.json({ video, comments });
}
