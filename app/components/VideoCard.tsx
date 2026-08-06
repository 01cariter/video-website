'use client';

import { Heart } from 'lucide-react';
import type { Video } from '@/lib/types';
import { bg, fmtDate, fmtLikes, hasPoster } from './media';

interface VideoCardProps {
  video: Video;
  index: number;
  sizeClass: string;
  onOpen: (video: Video) => void;
  onWarm: (video: Video) => void;
}

export default function VideoCard({ video, index, sizeClass, onOpen, onWarm }: VideoCardProps) {
  const showPoster = hasPoster(video.poster_url);

  return (
    <article className={`vcard ${sizeClass}`}>
      <div
        className="vcard-media"
        style={{ background: bg(video.poster_url, video.category, index) }}
      />
      {showPoster && <span className="vcard-shade" aria-hidden="true" />}
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
