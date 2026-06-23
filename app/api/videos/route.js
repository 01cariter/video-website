import { NextResponse } from 'next/server';
import { getFeed } from '@/lib/videos';
import { getCurrentUser } from '@/lib/user';

export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let category = searchParams.get('category');
  if (category === 'all' || !category) category = null;

  const user = await getCurrentUser();
  const videos = await getFeed({ category, userId: user?.id ?? null });

  return NextResponse.json({ videos });
}
