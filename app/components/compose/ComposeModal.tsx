'use client';

import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import MediaUploader from '../MediaUploader';
import type { AppUser, Video } from '@/lib/types';

interface ComposeModalProps {
  user: AppUser;
  onClose: () => void;
  onPublished: (video: Video) => void;
}

const MODAL_EASE = [0.22, 1, 0.36, 1] as const;

// Post is upload-only — no AI/Solo choice here. Studio is the one surface
// that embeds Worksolo; this modal never renders it.
export default function ComposeModal({ user, onClose, onPublished }: ComposeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prefersReducedMotion = Boolean(useReducedMotion());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  function closeFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="create-modal"
      aria-label="Post"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={closeFromBackdrop}
    >
      <motion.div
        className="create-modal-shell"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: MODAL_EASE }}
      >
        <div className="solo-shell">
          <header className="solo-header">
            <div className="solo-header-left">
              <button type="button" className="back" onClick={onClose} aria-label="Close" title="Close">
                <X aria-hidden="true" />
                <span>Close</span>
              </button>
              <span className="solo-divider" />
              <div className="stitle">
                <span className="mark" />
                <span>Post</span>
              </div>
            </div>
          </header>
          <MediaUploader user={user} onPublished={onPublished} />
        </div>
      </motion.div>
    </dialog>
  );
}
