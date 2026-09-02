'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { Video, VideoAsset } from '@/lib/types';
import { bg, placeholderColor } from '../media';

interface MediaCarouselProps {
  video: Video;
  className?: string;
  onOpen?: (index: number) => void;
  showPlayHint?: boolean;
}

function coverFor(asset: VideoAsset, video: Video) {
  if (asset.kind === 'image' && asset.url) return asset.url;
  if (asset.kind === 'video') return video.poster_url;
  return null;
}

function aspectRatioFor(asset: VideoAsset, video: Video) {
  const width = asset.width || (asset.kind === 'video' ? video.video_w : video.poster_w);
  const height = asset.height || (asset.kind === 'video' ? video.video_h : video.poster_h);
  if (width && height && width > 0 && height > 0) return `${width} / ${height}`;
  return asset.kind === 'video' ? '16 / 9' : '4 / 3';
}

function sampleAverageColor(image: HTMLImageElement): string | null {
  try {
    const size = 12;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 32) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
    if (!n) return null;
    return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
  } catch {
    return null;
  }
}

export default function MediaCarousel({
  video,
  className = '',
  onOpen,
  showPlayHint = true,
}: MediaCarouselProps) {
  const assets = video.assets ?? [];
  const [index, setIndex] = useState(0);
  const [toneByCover, setToneByCover] = useState<Record<string, string>>({});

  const safeIndex = assets.length > 0 ? Math.min(index, assets.length - 1) : 0;
  const asset = assets[safeIndex] ?? null;
  if (!asset) return null;

  const cover = coverFor(asset, video);
  const aspectRatio = aspectRatioFor(asset, video);
  const fallback = placeholderColor(video.category, video.id + safeIndex);
  const mediaTone = cover ? toneByCover[cover] : undefined;

  function go(delta: number, event: MouseEvent) {
    event.stopPropagation();
    setIndex((current) => {
      const next = current + delta;
      if (next < 0 || next >= assets.length) return current;
      return next;
    });
  }

  return (
    <div className={`mc ${className}`.trim()}>
      <button
        type="button"
        className="mc-slide"
        style={{
          aspectRatio,
          background: mediaTone || (cover ? fallback : bg(null, video.category, video.id + safeIndex)),
        }}
        aria-label={
          assets.length > 1
            ? `Preview media ${safeIndex + 1} of ${assets.length}`
            : 'Preview media'
        }
        onClick={() => onOpen?.(safeIndex)}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="mc-slide-media"
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            crossOrigin="anonymous"
            onLoad={(event) => {
              const tone = sampleAverageColor(event.currentTarget);
              if (!tone) return;
              setToneByCover((current) =>
                current[cover] === tone ? current : { ...current, [cover]: tone },
              );
            }}
          />
        ) : null}
        {asset.kind === 'video' && showPlayHint ? (
          <span className="mc-play" aria-hidden="true">
            <Play />
          </span>
        ) : null}
      </button>

      {assets.length > 1 && (
        <>
          <button
            type="button"
            className="mc-nav prev"
            onClick={(event) => go(-1, event)}
            disabled={safeIndex === 0}
            aria-label="Previous media"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="mc-nav next"
            onClick={(event) => go(1, event)}
            disabled={safeIndex === assets.length - 1}
            aria-label="Next media"
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <div className="mc-dots" aria-hidden="true">
            {assets.map((item, dotIndex) => (
              <i key={`${item.media_id}-${dotIndex}`} className={dotIndex === safeIndex ? 'on' : ''} />
            ))}
          </div>
          <span className="mc-count">
            {safeIndex + 1}/{assets.length}
          </span>
        </>
      )}
    </div>
  );
}
