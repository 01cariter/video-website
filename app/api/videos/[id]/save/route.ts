import { NextResponse, type NextRequest } from 'next/server';
import { toggleSave } from '@/lib/videos';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// POST /api/videos/:id/save - toggle a saved item / favourite for the user.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to save videos.' }, { status: 401 });
  }

  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  try {
    const result = await toggleSave({ userId: user.id, videoId });
    return NextResponse.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[snackd] save failed', { videoId, detail });
    return NextResponse.json(
      { error: 'The save could not be recorded.' },
      { status: 500 },
    );
  }
}
