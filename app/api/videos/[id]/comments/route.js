import { NextResponse } from 'next/server';
import { getComments, addComment } from '@/lib/videos';
import { getCurrentUser } from '@/lib/user';

export const runtime = 'nodejs';

// GET /api/videos/:id/comments — list comments (newest first).
export async function GET(request, { params }) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }
  const comments = await getComments(videoId);
  return NextResponse.json({ comments });
}

// POST /api/videos/:id/comments — add a comment.
export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to comment.' }, { status: 401 });
  }

  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  const { body } = await request.json().catch(() => ({}));
  const result = await addComment({ userId: user.id, videoId, body });
  if (!result) {
    return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
