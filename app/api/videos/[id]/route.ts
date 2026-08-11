import { NextResponse, type NextRequest } from 'next/server';
import { getVideoById } from '@/lib/videos';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/videos/:id — post body only. Comments load from /comments.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  const user = await getAuthUser();
  const video = await getVideoById({ id: videoId, userId: user?.id ?? null });
  if (!video) {
    return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  }
  return NextResponse.json({ video });
}
