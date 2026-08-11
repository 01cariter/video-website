import { NextResponse } from 'next/server';
import { getSavedVideos } from '@/lib/profiles';
import { getCurrentUser } from '@/lib/user';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const videos = await getSavedVideos({ userId: user.id });
  return NextResponse.json({ videos });
}
