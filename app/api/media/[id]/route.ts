import { NextResponse, type NextRequest } from 'next/server';
import { getMedia } from '@/lib/media';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isInteger(mediaId)) {
    return NextResponse.json({ error: 'Invalid media id.' }, { status: 400 });
  }

  const row = await getMedia(mediaId);
  if (!row) return NextResponse.json({ error: 'Media not found.' }, { status: 404 });

  const headers = {
    'Content-Type': row.mime || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };

  if (row.data) {
    const bytes = toBytes(row.data);
    if (bytes) return new NextResponse(bytes, { headers });
  }

  if (row.url?.startsWith('data:')) {
    const decoded = decodeDataUri(row.url);
    if (decoded) {
      return new NextResponse(decoded.bytes, {
        headers: { ...headers, 'Content-Type': decoded.mime || headers['Content-Type'] },
      });
    }
  }

  if (row.url) return NextResponse.redirect(row.url);
  return NextResponse.json({ error: 'Media has no content.' }, { status: 404 });
}

function toBytes(data: Buffer | Uint8Array | string) {
  if (typeof data === 'string') {
    return data.startsWith('\\x') ? new Uint8Array(Buffer.from(data.slice(2), 'hex')) : null;
  }
  return new Uint8Array(data);
}

function decodeDataUri(uri: string) {
  const match = /^data:([^;,]*)?(;base64)?,(.*)$/s.exec(uri);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const payload = match[3] || '';
  const buffer = match[2]
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  return { mime, bytes: new Uint8Array(buffer) };
}
