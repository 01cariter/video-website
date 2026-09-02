'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Trash2, X } from 'lucide-react';
import {
  MAX_COLLECTION_TITLE_LENGTH,
  type Collection,
} from '@/lib/types';

const MAX_DESCRIPTION = 200;

export default function CollectionEditDialog({
  collection,
  onClose,
}: {
  collection: Collection;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(collection.title);
  const [description, setDescription] = useState(collection.description ?? '');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  async function send(
    method: 'PATCH' | 'DELETE',
    body?: Record<string, unknown>,
  ) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/collections/${collection.id}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'That did not save.');
      return true;
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : 'That did not save.',
      );
      setBusy(false);
      return false;
    }
  }

  async function save() {
    const name = title.replace(/\s+/g, ' ').trim();
    if (!name) {
      setError('Give the collection a name.');
      return;
    }
    if (await send('PATCH', { title: name, description })) {
      onClose();
      router.refresh();
    }
  }

  async function remove() {
    if (await send('DELETE')) {
      router.replace('/');
      router.refresh();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fdlg-modal"
      aria-labelledby="collection-edit-title"
      onClick={(event: MouseEvent<HTMLDialogElement>) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        className="fdlg-card"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <header className="fdlg-head">
          <h2 id="collection-edit-title">Edit collection</h2>
          <button
            type="button"
            className="fdlg-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="fdlg-body">
          <div className="fdlg-fld">
            <div className="fdlg-label-row">
              <label htmlFor="collection-title">Name</label>
              <span className="tabular-nums">
                {title.length}/{MAX_COLLECTION_TITLE_LENGTH}
              </span>
            </div>
            <input
              id="collection-title"
              value={title}
              maxLength={MAX_COLLECTION_TITLE_LENGTH}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
              required
              autoFocus
            />
          </div>

          <div className="fdlg-fld">
            <div className="fdlg-label-row">
              <label htmlFor="collection-description">
                Description <small>optional</small>
              </label>
              <span className="tabular-nums">
                {description.length}/{MAX_DESCRIPTION}
              </span>
            </div>
            <textarea
              id="collection-description"
              value={description}
              rows={3}
              maxLength={MAX_DESCRIPTION}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What ties these posts together?"
              disabled={busy}
            />
          </div>

          <p className="fdlg-static">
            Deleting a collection keeps its{' '}
            <b>
              <span className="tabular-nums">{collection.posts_count}</span>{' '}
              {collection.posts_count === 1 ? 'post' : 'posts'}
            </b>{' '}
            — only the grouping goes.
          </p>

          {error ? (
            <p className="fdlg-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="fdlg-foot">
          {confirming ? (
            <>
              <span className="fdlg-confirm">Delete this collection?</span>
              <button
                type="button"
                className="fdlg-ghost"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Keep it
              </button>
              <button
                type="button"
                className="fdlg-danger"
                onClick={() => void remove()}
                disabled={busy}
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="fdlg-danger-ghost"
                onClick={() => setConfirming(true)}
                disabled={busy}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </button>
              <button
                type="button"
                className="fdlg-ghost"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="fdlg-save"
                disabled={busy || !title.trim()}
              >
                {busy && <LoaderCircle className="fdlg-spin" aria-hidden="true" />}
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </footer>
      </form>
    </dialog>
  );
}
