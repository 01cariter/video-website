import { NextResponse, type NextRequest } from 'next/server';
import { getCollection, getCollectionEpisodes } from '@/lib/collections';

export const runtime = 'nodejs';

// GET /api/collections/:id/episodes — the switcher on a post detail page.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collectionId = Number(id);
  if (!Number.isInteger(collectionId) || collectionId <= 0) {
    return NextResponse.json({ error: 'Invalid collection.' }, { status: 400 });
  }
  const [collection, episodes] = await Promise.all([
    getCollection(collectionId),
    getCollectionEpisodes(collectionId),
  ]);
  if (!collection) {
    return NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
  }
  return NextResponse.json({ collection, episodes });
}
