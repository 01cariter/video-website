import { NextResponse } from 'next/server';
import { getSuggestedAuthors } from '@/lib/profiles';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthUser();
  const authors = await getSuggestedAuthors({ viewerId: user?.id ?? null, limit: 3 });
  return NextResponse.json({ authors });
}
