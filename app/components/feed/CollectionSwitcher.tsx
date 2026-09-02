'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import type { CollectionEpisode, Video } from '@/lib/types';
import { useT } from '../i18n-provider';

interface EpisodesResponse {
  collection?: { id: number; title: string; posts_count: number };
  episodes?: CollectionEpisode[];
}

/**
 * The episode rail on a post's own detail page — the only place a reader
 * switches between posts in a collection. Everywhere else a post just says
 * which collection it came from.
 */
export default function CollectionSwitcher({ video }: { video: Video }) {
  const router = useRouter();
  const t = useT();
  const collectionId = video.collection_id;
  const [episodes, setEpisodes] = useState<CollectionEpisode[]>([]);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collectionId) return;
    const controller = new AbortController();
    void fetch(`/api/collections/${collectionId}/episodes`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: EpisodesResponse | null) => setEpisodes(data?.episodes ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, [collectionId]);

  const index = episodes.findIndex((episode) => episode.id === video.id);

  // Keep the episode being read in view as the reader moves through them.
  useEffect(() => {
    if (index < 0) return;
    railRef.current
      ?.querySelector(`[data-episode="${video.id}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [index, video.id]);

  if (!collectionId || !video.collection_title || episodes.length < 2) {
    return null;
  }

  const previous = index > 0 ? episodes[index - 1] : null;
  const next =
    index >= 0 && index < episodes.length - 1 ? episodes[index + 1] : null;

  return (
    <section className="col-switch" aria-label={t('collection.episodes')}>
      <header>
        <Link className="col-switch-title" href={`/c/${collectionId}`}>
          <Layers aria-hidden="true" />
          <b>{video.collection_title}</b>
        </Link>
        <span className="col-switch-count tabular-nums">
          {index >= 0 ? `${index + 1} / ${episodes.length}` : episodes.length}
        </span>
        <div className="col-switch-nav">
          <button
            type="button"
            disabled={!previous}
            aria-label={t('collection.previousEpisode')}
            onClick={() => previous && router.push(`/videos/${previous.id}`)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!next}
            aria-label={t('collection.nextEpisode')}
            onClick={() => next && router.push(`/videos/${next.id}`)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="col-switch-rail" ref={railRef}>
        {episodes.map((episode, position) => {
          const current = episode.id === video.id;
          return (
            <Link
              key={episode.id}
              data-episode={episode.id}
              className={current ? 'col-episode on' : 'col-episode'}
              href={`/videos/${episode.id}`}
              aria-current={current ? 'page' : undefined}
              style={
                episode.poster_url
                  ? { backgroundImage: `url(${episode.poster_url})` }
                  : undefined
              }
            >
              <span className="col-episode-index tabular-nums">
                {position + 1}
              </span>
              <span className="col-episode-title">{episode.title}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
