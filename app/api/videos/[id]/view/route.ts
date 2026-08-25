import { NextResponse, type NextRequest } from 'next/server';
import { recordVideoView } from '@/lib/videos';

export const runtime = 'nodejs';

// POST /api/videos/:id/view - one open of the player is one view. Signed out
// readers count too: they are watching, and the feed already serves them.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  try {
    const views = await recordVideoView(videoId);
    return NextResponse.json({ views_count: views });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[snackd] view failed', { videoId, detail });
    return NextResponse.json(
      { error: 'The view could not be counted.' },
      { status: 500 },
    );
  }
}
