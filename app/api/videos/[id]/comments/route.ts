import { NextResponse, type NextRequest } from 'next/server';
import { getComments, addComment } from '@/lib/videos';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/videos/:id/comments - list comments (newest first).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }
  const comments = await getComments(videoId);
  return NextResponse.json({ comments });
}

// POST /api/videos/:id/comments - add a comment.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to comment.' }, { status: 401 });
  }

  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  const payload = (await request.json().catch(() => ({}))) as { body?: unknown };
  const { body } = payload;
  try {
    const result = await addComment({ userId: user.id, videoId, body });
    if (!result) {
      return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[snackd] comment failed', { videoId, detail });
    return NextResponse.json({ error: 'The comment could not be posted.', detail }, { status: 500 });
  }
}
