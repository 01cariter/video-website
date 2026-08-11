import { ImageResponse } from 'next/og';
import { getVideoById } from '@/lib/videos';

export const runtime = 'nodejs';
export const alt = 'Snackd video';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const videoId = Number(id);
  const video = Number.isInteger(videoId) ? await getVideoById({ id: videoId }) : null;
  const accent = video?.category === 'study' ? '#3f7d92' : '#cf4f2a';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '66px 72px',
          background: '#171613',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 34, fontWeight: 700 }}>
          <div
            style={{
              width: 54,
              height: 54,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              background: accent,
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            S
          </div>
          Snackd
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, maxWidth: 1020 }}>
          <div style={{ width: 82, height: 8, background: accent }} />
          <div style={{ fontSize: 76, lineHeight: 1.06, fontWeight: 760 }}>
            {video?.title || 'Video not found'}
          </div>
          <div style={{ display: 'flex', gap: 20, color: '#c9c4bb', fontSize: 28 }}>
            <span>{video?.author_name || 'Snackd'}</span>
            {video?.author_handle && <span>{video.author_handle}</span>}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
