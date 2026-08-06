'use client';

import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import CreateWorkspace from './CreateWorkspace';
import type { AppUser } from '@/lib/types';

interface CreateModalProps {
  user: AppUser;
  soloUrl: string;
  onClose: () => void;
}

const MODAL_EASE = [0.22, 1, 0.36, 1] as const;

export default function CreateModal({ user, soloUrl, onClose }: CreateModalProps) {
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
      aria-label="Create a post"
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
        <CreateWorkspace user={user} soloUrl={soloUrl} onClose={onClose} />
      </motion.div>
    </dialog>
  );
}
