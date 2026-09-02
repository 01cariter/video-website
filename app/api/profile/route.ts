import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAuthUser } from '@/lib/supabase/server';
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  updateProfile,
} from '@/lib/profiles';

export const runtime = 'nodejs';

interface ProfilePatchBody {
  displayName?: unknown;
  bio?: unknown;
  avatarMediaId?: unknown;
}

// PATCH /api/profile — edit the signed-in account's own profile.
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: 'You must be signed in to edit your profile.' },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as ProfilePatchBody;
  const displayName = String(body.displayName ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH);
  if (!displayName) {
    return NextResponse.json(
      { error: 'Your display name cannot be empty.' },
      { status: 400 },
    );
  }

  const bio = String(body.bio ?? '').trim().slice(0, MAX_BIO_LENGTH) || null;

  let avatarMediaId: number | null = null;
  if (body.avatarMediaId !== null && body.avatarMediaId !== undefined) {
    const parsed = Number(body.avatarMediaId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json({ error: 'Invalid avatar.' }, { status: 400 });
    }
    avatarMediaId = parsed;
  }

  try {
    const profile = await updateProfile({
      userId: user.id,
      displayName,
      bio,
      avatarMediaId,
    });
    revalidateTag('videos-feed', 'max');
    return NextResponse.json({ profile });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[snackd] profile update failed', { userId: user.id, detail });
    return NextResponse.json(
      { error: detail || 'Your profile could not be saved.' },
      { status: 400 },
    );
  }
}
