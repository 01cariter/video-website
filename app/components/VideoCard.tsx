'use client';

import { getColor } from 'colorthief';
import { Heart } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import BlurEffect from 'react-progressive-blur';
import type { Video } from '@/lib/types';
import { bg, fmtDate, fmtLikes, hasPoster, placeholderColor } from './media';

interface VideoCardProps {
  video: Video;
  index: number;
  sizeClass: string;
  onOpen: (video: Video) => void;
  onWarm: (video: Video) => void;
}

const shadeCache = new Map<string, string>();

/** Load poster → ColorThief dominant color from the bottom band (for the shade). */
async function extractShade(url: string): Promise<string | null> {
  const cached = shadeCache.get(url);
  if (cached) return cached;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('poster load failed'));
    el.src = url;
  });

  // Sample the lower third — same zone the shade covers.
  const color = await getColor(img, {
    region: { x: 0, y: 0.66, width: 1, height: 0.34 },
    quality: 10,
  });
  if (!color) return null;

  // Light swatches wash out white titles — lean them darker for the shade.
  let hex = color.hex();
  if (color.isLight) {
    const { r, g, b } = color.rgb();
    const d = (n: number) => Math.round(n * 0.42);
    hex = `#${[d(r), d(g), d(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  }
  shadeCache.set(url, hex);
  return hex;
}

export default function VideoCard({ video, index, sizeClass, onOpen, onWarm }: VideoCardProps) {
  const baseColor = placeholderColor(video.category, index);
  const poster = hasPoster(video.poster_url) ? video.poster_url : null;
  const [shade, setShade] = useState(() =>
    poster && shadeCache.has(poster) ? shadeCache.get(poster)! : baseColor,
  );

  useEffect(() => {
    if (!poster) {
      setShade(baseColor);
      return;
    }
    if (shadeCache.has(poster)) {
      setShade(shadeCache.get(poster)!);
      return;
    }

    let cancelled = false;
    extractShade(poster)
      .then((hex) => {
        if (!cancelled) setShade(hex || baseColor);
      })
      .catch(() => {
        if (!cancelled) setShade(baseColor);
      });

    return () => {
      cancelled = true;
    };
  }, [poster, baseColor]);

  return (
    <article
      className={`vcard ${sizeClass}`}
      style={{ '--vcard-shade': shade } as CSSProperties}
    >
      <div
        className="vcard-media"
        style={{ background: bg(video.poster_url, video.category, index) }}
      />

      {/* Blur under, colored shade on top — avoids a milky band from frosted glass over a fading tint. */}
      <BlurEffect position="bottom" intensity={160} className="vcard-pblur" />
      <span className="vcard-grad" aria-hidden="true" />

      <button
        type="button"
        className="vcard-open"
        onClick={() => onOpen(video)}
        onPointerEnter={() => onWarm(video)}
        onFocus={() => onWarm(video)}
        aria-label={`Open ${video.title}`}
      />

      <div className="vcard-top">
        <span className="vcard-likes">
          <Heart aria-hidden="true" />
          {fmtLikes(video.likes_count)}
        </span>
      </div>

      <div className="vcard-info">
        <b>{video.title}</b>
        <span className="vcard-author">
          <span>{video.author_handle}</span>
          <time dateTime={video.created_at}>{fmtDate(video.created_at)}</time>
        </span>
      </div>
    </article>
  );
}
