import { NextResponse, type NextRequest } from 'next/server';
import {
  deleteCollection,
  reorderCollection,
  updateCollection,
} from '@/lib/collections';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function collectionId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function failure(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('[snackd] collection write failed', { detail });
  return NextResponse.json({ error: detail }, { status: 400 });
}

// PATCH /api/collections/:id — rename, re-describe, or reorder its episodes.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const id = collectionId((await params).id);
  if (!id) {
    return NextResponse.json({ error: 'Invalid collection.' }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    title?: unknown;
    description?: unknown;
    order?: unknown;
  };

  try {
    if (Array.isArray(body.order)) {
      await reorderCollection({
        id,
        userId: user.id,
        order: body.order.map((value) => Number(value)),
      });
      return NextResponse.json({ ok: true });
    }
    const collection = await updateCollection({
      id,
      userId: user.id,
      title: String(body.title ?? ''),
      description:
        typeof body.description === 'string' ? body.description : null,
    });
    return NextResponse.json({ collection });
  } catch (error) {
    return failure(error);
  }
}

// DELETE /api/collections/:id — removes the grouping, never the posts.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const id = collectionId((await params).id);
  if (!id) {
    return NextResponse.json({ error: 'Invalid collection.' }, { status: 400 });
  }
  try {
    await deleteCollection({ id, userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
