import { NextResponse, type NextRequest } from 'next/server';
import {
  createCollection,
  listOwnedCollections,
  normalizeCollectionTitle,
} from '@/lib/collections';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/collections — the signed-in creator's own collections.
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ collections: [] });
  }
  return NextResponse.json({ collections: await listOwnedCollections(user.id) });
}

// POST /api/collections — create one, so the composer can make it inline.
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to create a collection.' },
      { status: 401 },
    );
  }
  const body = (await request.json().catch(() => ({}))) as {
    title?: unknown;
    description?: unknown;
  };
  const title = normalizeCollectionTitle(body.title);
  if (!title) {
    return NextResponse.json(
      { error: 'Give the collection a name.' },
      { status: 400 },
    );
  }
  try {
    const collection = await createCollection({
      userId: user.id,
      title,
      description:
        typeof body.description === 'string' ? body.description : null,
    });
    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[snackd] collection create failed', { detail });
    return NextResponse.json(
      { error: 'The collection could not be created.' },
      { status: 500 },
    );
  }
}
