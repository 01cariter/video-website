import { NextResponse } from 'next/server';
import { getMedia } from '@/lib/media';

export const runtime = 'nodejs';

// GET /api/media/:id — serve a media item from our own database.
//   • inline bytes (BYTEA)      → returned directly
//   • base64/utf8 `data:` URI   → decoded and returned with its mime
//   • external/self URL         → redirected
export async function GET(request, { params }) {
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

  // 1) Inline BYTEA bytes.
  if (row.data) {
    const buf = toBuffer(row.data);
    if (buf) return new NextResponse(buf, { headers });
  }

  // 2) `data:` URI stored in `url`.
  if (row.url && row.url.startsWith('data:')) {
    const decoded = decodeDataUri(row.url);
    if (decoded) {
      return new NextResponse(decoded.bytes, {
        headers: { ...headers, 'Content-Type': decoded.mime || headers['Content-Type'] },
      });
    }
  }

  // 3) Plain URL → redirect.
  if (row.url) return NextResponse.redirect(row.url);

  return NextResponse.json({ error: 'Media has no content.' }, { status: 404 });
}

// Neon may return BYTEA as a Buffer or a `\x..` hex string.
function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (typeof data === 'string' && data.startsWith('\\x')) return Buffer.from(data.slice(2), 'hex');
  return null;
}

function decodeDataUri(uri) {
  const m = /^data:([^;,]*)?(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  const isB64 = !!m[2];
  const bytes = isB64
    ? Buffer.from(m[3], 'base64')
    : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  return { mime, bytes };
}
