import { NextResponse } from 'next/server';
import { toggleSave } from '@/lib/videos';
import { getCurrentUser } from '@/lib/user';

export const runtime = 'nodejs';

// POST /api/videos/:id/save — toggle a save / favourite (收藏) for the user.
export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to save videos.' }, { status: 401 });
  }

  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  const result = await toggleSave({ userId: user.id, videoId });
  return NextResponse.json(result);
}
