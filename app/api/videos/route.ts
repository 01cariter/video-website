import { NextResponse, type NextRequest } from 'next/server';
import { getFeedPage } from '@/lib/videos';
import { getAuthUser } from '@/lib/supabase/server';
import type { VideoCategory } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get('category');
  const category: VideoCategory | null = value === 'study' || value === 'play' ? value : null;
  const cursor = request.nextUrl.searchParams.get('cursor');
  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || 12);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 12;

  const user = await getAuthUser();
  const page = await getFeedPage({
    category,
    cursor,
    limit,
    userId: user?.id ?? null,
  });

  return NextResponse.json(page);
}
