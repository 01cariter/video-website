import Link from 'next/link';
import { Heart, Play } from 'lucide-react';
import type { Video } from '@/lib/types';
import { postHeadline } from '@/lib/post-text';
import { fmtLikes, fmtRelativeTime } from '../media';

function thumbnail(video: Video) {
  return video.assets?.[0]?.url ?? video.poster_url ?? null;
}

function hasVideo(video: Video) {
  return (
    (video.assets ?? []).some((asset) => asset.kind === 'video') ||
    Boolean(video.video_url)
  );
}

/**
 * The episode list on a collection page. Ordered by publication, so episode
 * numbers are positions in this list and never need storing.
 */
export default function CollectionEpisodes({ videos }: { videos: Video[] }) {
  if (videos.length === 0) {
    return (
      <div className="empty">
        <Play aria-hidden="true" />
        <p>Nothing has been added to this collection yet.</p>
      </div>
    );
  }

  return (
    <ol className="col-list">
      {videos.map((video, index) => {
        const thumb = thumbnail(video);
        return (
          <li key={video.id}>
            <Link className="col-row" href={`/videos/${video.id}`}>
              <span className="col-index tabular-nums">{index + 1}</span>
              <span
                className={thumb ? 'col-thumb' : 'col-thumb col-thumb-empty'}
                style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                aria-hidden="true"
              >
                {hasVideo(video) ? <Play /> : null}
              </span>
              <span className="col-copy">
                <b>{postHeadline(video)}</b>
                <small>
                  <time dateTime={video.created_at}>
                    {fmtRelativeTime(video.created_at)}
                  </time>
                  <span aria-hidden="true">·</span>
                  <Heart aria-hidden="true" />
                  <span className="tabular-nums">
                    {fmtLikes(video.likes_count)}
                  </span>
                </small>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
