import { NextResponse, type NextRequest } from 'next/server';
import { toggleLike } from '@/lib/videos';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to like videos.' }, { status: 401 });
  }

  // Next 15+/16: route `params` is async and must be awaited.
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  // A missing `toggle_video_like` (an unapplied migration) reads as a bare 500
  // with nothing in it. Postgres always says what it objected to — keep it.
  try {
    const result = await toggleLike({ userId: user.id, videoId });
    return NextResponse.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[snackd] like failed', { videoId, detail });
    return NextResponse.json({ error: 'The like could not be saved.', detail }, { status: 500 });
  }
}
