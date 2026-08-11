import { NextResponse, type NextRequest } from 'next/server';
import { parseFeedQuery } from '@/lib/feed-mode';
import { createVideo, getFeedPage } from '@/lib/videos';
import { getAuthUser } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import type { FeedFilter, VideoCategory } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LABEL_LENGTH = 24;
const MAX_DURATION_LENGTH = 12;

interface CreateVideoBody {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  label?: unknown;
  posterMediaId?: unknown;
  videoMediaId?: unknown;
  duration?: unknown;
}

export async function GET(request: NextRequest) {
  const { mode, category } = parseFeedQuery({
    mode: request.nextUrl.searchParams.get('mode'),
    category: request.nextUrl.searchParams.get('category'),
  });
  const cursor = request.nextUrl.searchParams.get('cursor');
  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || 12);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 12;

  const filter: FeedFilter =
    mode === 'following'
      ? { kind: 'following' }
      : category
        ? { kind: 'category', category }
        : { kind: 'foryou' };

  const user = await getAuthUser();
  const page = await getFeedPage({
    filter,
    cursor,
    limit,
    userId: user?.id ?? null,
  });

  return NextResponse.json(page);
}

// POST /api/videos - publish an uploaded photo or clip to the feed.
export async function POST(request: NextRequest) {
  // getCurrentUser (not getAuthUser) so the `profiles` row the author_id
  // foreign key points at is guaranteed to exist.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to post.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateVideoBody;

  const title = trimmed(body.title, MAX_TITLE_LENGTH);
  if (!title) {
    return NextResponse.json({ error: 'A title is required.' }, { status: 400 });
  }

  const category = body.category === 'study' || body.category === 'play' ? body.category : null;
  if (!category) {
    return NextResponse.json({ error: 'Category must be "study" or "play".' }, { status: 400 });
  }

  const posterMediaId = mediaIdOrNull(body.posterMediaId);
  const videoMediaId = mediaIdOrNull(body.videoMediaId);
  if (posterMediaId === null && videoMediaId === null) {
    return NextResponse.json({ error: 'Attach a photo or a video first.' }, { status: 400 });
  }

  try {
    const video = await createVideo({
      userId: user.id,
      title,
      description: trimmed(body.description, MAX_DESCRIPTION_LENGTH) || null,
      category,
      label: trimmed(body.label, MAX_LABEL_LENGTH).toUpperCase() || null,
      posterMediaId,
      videoMediaId,
      duration: trimmed(body.duration, MAX_DURATION_LENGTH),
    });
    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'The post could not be published.', detail }, { status: 400 });
  }
}

function trimmed(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function mediaIdOrNull(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
