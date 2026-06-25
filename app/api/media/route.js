import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { listMedia, createMediaFromUrl, createMediaFromBytes, kindFromMime } from '@/lib/media';

export const runtime = 'nodejs';

// GET /api/media — list media (optionally scoped to ?mine=1).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get('mine');
  let ownerId = null;
  if (mine) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    ownerId = user.id;
  }
  const media = await listMedia({ ownerId });
  return NextResponse.json({ media });
}

// POST /api/media — upload media into our own database.
//   • multipart/form-data with a `file`  → bytes stored inline (data: URI)
//   • application/json { url, kind?, mime?, width?, height?, durationSeconds? }
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to upload media.' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
      }
      const mime = file.type || 'application/octet-stream';
      const bytes = Buffer.from(await file.arrayBuffer());
      const media = await createMediaFromBytes({
        bytes,
        mime,
        width: numOrNull(form.get('width')),
        height: numOrNull(form.get('height')),
        durationSeconds: numOrNull(form.get('durationSeconds')),
        ownerId: user.id,
      });
      return NextResponse.json({ media }, { status: 201 });
    }

    const body = await request.json().catch(() => ({}));
    if (!body.url) {
      return NextResponse.json({ error: 'A `url` (or multipart `file`) is required.' }, { status: 400 });
    }
    const mime = body.mime || 'image/svg+xml';
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
  } catch (err) {
    return NextResponse.json({ error: 'Upload failed.', detail: String(err?.message || err) }, { status: 500 });
  }
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
