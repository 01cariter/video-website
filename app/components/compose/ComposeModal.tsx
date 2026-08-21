'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import MediaUploader from '../MediaUploader';
import type { AppUser, Video } from '@/lib/types';
import type { ComposeDraft } from './types';

interface ComposeModalProps {
  user: AppUser;
  initialDraft?: ComposeDraft;
  onClose: () => void;
  onPublished: (video: Video) => void;
}

const MODAL_EASE = [0.22, 1, 0.36, 1] as const;

// Post is upload-only — no AI/Solo choice here. Studio is the one surface
// that embeds Worksolo; this modal never renders it.
export default function ComposeModal({
  user,
  initialDraft,
  onClose,
  onPublished,
}: ComposeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  function closeFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (!busy && event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="create-modal"
      aria-labelledby="compose-modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={closeFromBackdrop}
    >
      <motion.div
        className="create-modal-shell"
        initial={
          prefersReducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{
          duration: prefersReducedMotion ? 0 : 0.18,
          ease: MODAL_EASE,
        }}
      >
        <div className="solo-shell">
          <header className="solo-header">
            <div className="solo-header-copy">
              <span className="mark" aria-hidden="true" />
              <div>
                <h1 id="compose-modal-title">Create post</h1>
                <p>Share work from your canvas or add media from your device.</p>
              </div>
            </div>
            <div className="solo-actions">
              {busy ? (
                <span className="solo-status" role="status">
                  Finishing…
                </span>
              ) : initialDraft ? (
                <span className="solo-status">
                  {initialDraft.assets?.length
                    ? `${initialDraft.assets.length} selected`
                    : 'Canvas draft'}
                </span>
              ) : null}
              <button
                type="button"
                className="solo-close disabled:cursor-not-allowed disabled:opacity-40"
                onClick={onClose}
                disabled={busy}
                aria-label={busy ? 'Wait for the current action to finish' : 'Close'}
                title={busy ? 'Wait for the current action to finish' : 'Close'}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </header>
          <MediaUploader
            user={user}
            initialDraft={initialDraft}
            onPublished={onPublished}
            onBusyChange={setBusy}
          />
        </div>
      </motion.div>
    </dialog>
  );
}
