'use client';

import { X } from 'lucide-react';
import { useT } from '../i18n-provider';

interface ActionNoticeProps {
  message: string;
  onDismiss: () => void;
}

export default function ActionNotice({ message, onDismiss }: ActionNoticeProps) {
  const t = useT();
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[150] flex justify-center px-4">
      <div
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground shadow-lg"
        role="alert"
      >
        <span>{message}</span>
        <button
          type="button"
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={t('common.dismiss')}
          onClick={onDismiss}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
