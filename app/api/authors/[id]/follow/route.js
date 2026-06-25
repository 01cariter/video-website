import { NextResponse } from 'next/server';
import { toggleFollow } from '@/lib/videos';
import { getCurrentUser } from '@/lib/user';

export const runtime = 'nodejs';

// POST /api/authors/:id/follow — toggle following an author (a profile user_id).
export async function POST(request, { params }) {
  const user = await getCurrentUser();
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

  const result = await toggleFollow({ followerId: user.id, authorId });
  return NextResponse.json(result);
}
