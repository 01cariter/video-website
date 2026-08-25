import { NextResponse, type NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  createMediaFromUrl,
  kindFromMime,
  listMedia,
  registerStorageMedia,
  uploadMediaFile,
} from '@/lib/media';
import type { MediaKind } from '@/lib/types';

export const runtime = 'nodejs';

interface MediaJsonBody {
  url?: string;
  storagePath?: string;
  kind?: MediaKind;
  mime?: string;
  width?: number | string | null;
  height?: number | string | null;
  durationSeconds?: number | string | null;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const media = await listMedia({ ownerId: user.id });
  return NextResponse.json({ media });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to upload media.' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
      }
      const mime = file.type || 'application/octet-stream';
      if (!ALLOWED_MEDIA_MIME_TYPES.has(mime)) {
        return NextResponse.json({ error: 'Unsupported media type.' }, { status: 415 });
      }
      if (file.size <= 0 || file.size > MAX_MEDIA_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: 'Uploads through this endpoint are limited to 4 MB.' },
          { status: 413 },
        );
      }
      const media = await uploadMediaFile({
        file,
        mime,
        width: numOrNull(form.get('width')),
        height: numOrNull(form.get('height')),
        durationSeconds: numOrNull(form.get('durationSeconds')),
        ownerId: user.id,
      });
      return NextResponse.json({ media }, { status: 201 });
    }

    const body = (await request.json().catch(() => ({}))) as MediaJsonBody;

    // The browser uploaded straight to Supabase Storage; register the metadata.
    if (body.storagePath) {
      const mime = body.mime || '';
      if (!ALLOWED_MEDIA_MIME_TYPES.has(mime)) {
        return NextResponse.json({ error: 'Unsupported media type.' }, { status: 415 });
      }
      const media = await registerStorageMedia({
        path: body.storagePath,
        mime,
        width: numOrNull(body.width),
        height: numOrNull(body.height),
        durationSeconds: numOrNull(body.durationSeconds),
        ownerId: user.id,
      });
      return NextResponse.json({ media }, { status: 201 });
    }

    if (!body.url) {
      return NextResponse.json(
        { error: 'A `url`, a `storagePath`, or a multipart `file` is required.' },
        { status: 400 },
      );
    }
    if (!isAllowedRemoteUrl(body.url)) {
      return NextResponse.json({ error: 'Only public HTTPS media URLs are accepted.' }, { status: 400 });
    }
    const mime = body.mime || (body.kind === 'video' ? 'video/mp4' : 'image/jpeg');
    if (!ALLOWED_MEDIA_MIME_TYPES.has(mime)) {
      return NextResponse.json({ error: 'Unsupported media type.' }, { status: 415 });
    }
    const media = await createMediaFromUrl({
      url: body.url,
      kind: body.kind || kindFromMime(mime),
      mime,
      width: numOrNull(body.width),
      height: numOrNull(body.height),
      durationSeconds: numOrNull(body.durationSeconds),
      ownerId: user.id,
    });
    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[snackd] media upload failed', { userId: user.id, detail });
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}

function numOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isAllowedRemoteUrl(value: string) {
  if (value.length > 2048) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
