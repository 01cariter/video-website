import { NextResponse, type NextRequest } from 'next/server';
import { deleteVideo, getVideoById } from '@/lib/videos';
import { setVideoCollection } from '@/lib/collections';
import { removeOwnedStorageMedia } from '@/lib/media';
import { getAuthUser, getVerifiedAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/videos/:id — post body only. Comments load from /comments.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  const user = await getAuthUser();
  const video = await getVideoById({ id: videoId, userId: user?.id ?? null });
  if (!video) {
    return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  }
  return NextResponse.json({ video });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getVerifiedAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to delete a post.' }, { status: 401 });
  }

  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  const deleted = await deleteVideo({ userId: user.id, videoId });
  if (!deleted) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  }

  try {
    await removeOwnedStorageMedia({ urls: deleted.storageUrls, ownerId: user.id });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[snackd] post media cleanup failed', { videoId, detail });
  }

  return NextResponse.json({ deleted: true });
}

// PATCH /api/videos/:id — move an already-published post between collections.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getVerifiedAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId) || videoId <= 0) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    collectionId?: unknown;
    newCollectionTitle?: unknown;
  };
  const requested = Number(body.collectionId);

  try {
    const collectionId = await setVideoCollection({
      videoId,
      userId: user.id,
      collectionId: Number.isInteger(requested) && requested > 0 ? requested : null,
      newCollectionTitle:
        typeof body.newCollectionTitle === 'string'
          ? body.newCollectionTitle
          : null,
    });
    return NextResponse.json({ collectionId });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[snackd] post collection change failed', { videoId, detail });
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
