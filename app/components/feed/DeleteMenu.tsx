'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';
import { Check, ChevronRight, Layers, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  MAX_COLLECTION_TITLE_LENGTH,
  type CollectionSummary,
  type Video,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '../i18n-provider';

interface DeleteMenuProps {
  itemLabel: 'post' | 'comment';
  onDelete: () => Promise<void>;
  className?: string;
  disabled?: boolean;
  /** Supplied for a post the signed-in reader owns; adds collection controls. */
  video?: Video;
}

export default function DeleteMenu({
  itemLabel,
  onDelete,
  className,
  disabled = false,
  video,
}: DeleteMenuProps) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [naming, setNaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Only fetched once the menu is opened on a post — a feed of rows should not
  // ask for the reader's collections twenty times over.
  useEffect(() => {
    if (!open || !video) return;
    const controller = new AbortController();
    void fetch('/api/collections', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { collections?: CollectionSummary[] } | null) =>
        setCollections(data?.collections ?? []),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [open, video]);

  async function moveToCollection(
    collectionId: number | null,
    title?: string,
  ) {
    if (!video || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId,
          newCollectionTitle: title ?? null,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || t('collection.moveFailed'));
      }
      setOpen(false);
      setNaming(false);
      setNewTitle('');
      router.refresh();
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : t('collection.moveFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !busy) {
      setConfirming(false);
      setNaming(false);
      setNewTitle('');
      setError('');
    }
  }

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onDelete();
      setOpen(false);
      setConfirming(false);
    } catch {
      setError(
        itemLabel === 'post' ? t('post.deleteFailed') : t('comment.deleteFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={changeOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn('delete-menu-trigger', className)}
          aria-label={
            itemLabel === 'post' ? t('post.actions') : t('comment.actions')
          }
          disabled={disabled}
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="delete-menu-content"
          align="end"
          sideOffset={6}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {video && !confirming ? (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="delete-menu-item">
                <Layers aria-hidden="true" />
                {video.collection_title
                  ? t('collection.in', { title: video.collection_title })
                  : t('collection.add')}
                <ChevronRight className="delete-menu-chevron" aria-hidden="true" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  className="delete-menu-content delete-menu-sub"
                  sideOffset={4}
                >
                  {video.collection_id ? (
                    <DropdownMenu.Item
                      className="delete-menu-item"
                      disabled={busy}
                      onSelect={(event) => {
                        event.preventDefault();
                        void moveToCollection(null);
                      }}
                    >
                      {t('collection.remove')}
                    </DropdownMenu.Item>
                  ) : null}
                  {collections.map((collection) => (
                    <DropdownMenu.Item
                      key={collection.id}
                      className="delete-menu-item"
                      disabled={busy || collection.id === video.collection_id}
                      onSelect={(event) => {
                        event.preventDefault();
                        void moveToCollection(collection.id);
                      }}
                    >
                      {collection.id === video.collection_id ? (
                        <Check aria-hidden="true" />
                      ) : (
                        <Layers aria-hidden="true" />
                      )}
                      <span className="delete-menu-grow">{collection.title}</span>
                      <span className="tabular-nums">{collection.posts_count}</span>
                    </DropdownMenu.Item>
                  ))}
                  {naming ? (
                    <form
                      className="delete-menu-name"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (newTitle.trim()) void moveToCollection(null, newTitle);
                      }}
                    >
                      <input
                        value={newTitle}
                        onChange={(event) => setNewTitle(event.target.value)}
                        placeholder={t('collection.namePlaceholder')}
                        maxLength={MAX_COLLECTION_TITLE_LENGTH}
                        aria-label={t('collection.newName')}
                        autoFocus
                      />
                      <button type="submit" disabled={busy || !newTitle.trim()}>
                        {busy ? t('collection.adding') : t('common.create')}
                      </button>
                    </form>
                  ) : (
                    <DropdownMenu.Item
                      className="delete-menu-item"
                      disabled={busy}
                      onSelect={(event) => {
                        event.preventDefault();
                        setNaming(true);
                      }}
                    >
                      {t('collection.new')}
                    </DropdownMenu.Item>
                  )}
                  {error ? (
                    <p className="delete-menu-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          ) : null}
          {!confirming ? (
            <DropdownMenu.Item
              className="delete-menu-item danger"
              onSelect={(event) => {
                event.preventDefault();
                setConfirming(true);
              }}
            >
              <Trash2 aria-hidden="true" />
              {itemLabel === 'post' ? t('common.delete') : t('common.delete')}
            </DropdownMenu.Item>
          ) : (
            <div
              className="delete-menu-confirm"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <b>
                {itemLabel === 'post'
                  ? t('post.deleteConfirm')
                  : t('comment.deleteConfirm')}
              </b>
              <p>{t('post.deleteUndone')}</p>
              {error && <span role="alert">{error}</span>}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setError('');
                  }}
                  disabled={busy}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void confirmDelete()}
                  disabled={busy}
                >
                  {busy ? t('common.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
