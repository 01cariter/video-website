'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Heart,
  ListOrdered,
  Pencil,
  Play,
} from 'lucide-react';
import type { Collection, Video } from '@/lib/types';
import { postHeadline } from '@/lib/post-text';
import { fmtLikes, fmtRelativeTime } from '../media';
import CollectionEditDialog from './CollectionEditDialog';
import { useT } from '../i18n-provider';

function thumbnail(video: Video) {
  return video.assets?.[0]?.url ?? video.poster_url ?? null;
}

function hasVideo(video: Video) {
  return (
    (video.assets ?? []).some((asset) => asset.kind === 'video') ||
    Boolean(video.video_url)
  );
}

function moved(order: Video[], index: number, delta: number) {
  const next = [...order];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  return next;
}

/**
 * The episode list on a collection page, plus the owner's controls. Episode
 * numbers are positions in this list, so reordering is just sending the list
 * back in its new order.
 */
export default function CollectionEpisodes({
  collection,
  videos,
  isOwner,
}: {
  collection: Collection;
  videos: Video[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<Video[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = order ?? videos;

  async function saveOrder() {
    if (!order) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: order.map((video) => video.id) }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || t('collection.orderFailed'));
      }
      setOrder(null);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'The new order did not save.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (videos.length === 0) {
    return (
      <>
        {isOwner ? (
          <div className="col-owner">
            <button type="button" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              {t('collection.edit')}
            </button>
          </div>
        ) : null}
        <div className="empty">
          <Play aria-hidden="true" />
          <p>{t('collection.empty')}</p>
        </div>
        {editing ? (
          <CollectionEditDialog
            collection={collection}
            onClose={() => setEditing(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {isOwner ? (
        <div className="col-owner">
          {order ? (
            <>
              <span className="col-owner-note">{t('collection.reordering')}</span>
              <button
                type="button"
                onClick={() => {
                  setOrder(null);
                  setError('');
                }}
                disabled={busy}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="on"
                onClick={() => void saveOrder()}
                disabled={busy}
              >
                {busy ? t('common.saving') : t('collection.saveOrder')}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                {t('collection.edit')}
              </button>
              <button
                type="button"
                onClick={() => setOrder(videos)}
                disabled={videos.length < 2}
              >
                <ListOrdered aria-hidden="true" />
                {t('collection.reorder')}
              </button>
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="col-error" role="alert">
          {error}
        </p>
      ) : null}

      <ol className="col-list">
        {list.map((video, index) => {
          const thumb = thumbnail(video);
          const body = (
            <>
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
            </>
          );

          return (
            <li key={video.id}>
              {order ? (
                <div className="col-row col-row-static">
                  {body}
                  <span className="col-move">
                    <button
                      type="button"
                      aria-label={t('collection.moveUp', { title: postHeadline(video) })}
                      disabled={busy || index === 0}
                      onClick={() => setOrder(moved(list, index, -1))}
                    >
                      <ArrowUp aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('collection.moveDown', { title: postHeadline(video) })}
                      disabled={busy || index === list.length - 1}
                      onClick={() => setOrder(moved(list, index, 1))}
                    >
                      <ArrowDown aria-hidden="true" />
                    </button>
                  </span>
                </div>
              ) : (
                <Link className="col-row" href={`/videos/${video.id}`}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {editing ? (
        <CollectionEditDialog
          collection={collection}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}
