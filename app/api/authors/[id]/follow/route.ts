import { NextResponse, type NextRequest } from 'next/server';
import { toggleFollow } from '@/lib/videos';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// POST /api/authors/:id/follow - toggle following an author (a profile user_id).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to follow.' }, { status: 401 });
  }

  const { id: authorId } = await params;
  if (!authorId) {
    return NextResponse.json({ error: 'Invalid author id.' }, { status: 400 });
  }
  if (authorId === user.id) {
    return NextResponse.json({ error: 'You cannot follow yourself.' }, { status: 400 });
  }

  try {
    const result = await toggleFollow({ followerId: user.id, authorId });
    return NextResponse.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[snackd] follow failed', { authorId, detail });
    return NextResponse.json({ error: 'The follow could not be saved.', detail }, { status: 500 });
  }
}
