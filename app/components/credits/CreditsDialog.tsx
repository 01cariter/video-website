'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../i18n-provider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';

export default function CreditsDialog({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DialogContent
        className="h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-none gap-0 overflow-hidden rounded-[24px] border-border/80 bg-background p-0 shadow-[0_32px_100px_-32px_rgba(0,0,0,.6)] sm:h-[min(1040px,calc(100dvh-40px))] sm:w-[calc(100vw-40px)] sm:max-w-[1480px]"
        aria-label={t('credits.title')}
      >
        <DialogTitle className="sr-only">{t('credits.title')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('credits.lead')}
        </DialogDescription>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
