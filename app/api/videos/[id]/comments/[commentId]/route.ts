import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedAuthUser } from '@/lib/supabase/server';
import { deleteComment } from '@/lib/videos';

export const runtime = 'nodejs';

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; commentId: string }>;
  },
) {
  const user = await getVerifiedAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: 'You must be signed in to delete a comment.' },
      { status: 401 },
    );
  }

  const { id, commentId: rawCommentId } = await params;
  const videoId = Number(id);
  const commentId = Number(rawCommentId);
  if (!Number.isInteger(videoId) || !Number.isInteger(commentId)) {
    return NextResponse.json({ error: 'Invalid comment id.' }, { status: 400 });
  }

  const deleted = await deleteComment({ userId: user.id, videoId, commentId });
  if (!deleted) {
    return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });
  }

  return NextResponse.json(deleted);
}
