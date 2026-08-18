'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';

export default function CreditsDialog({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DialogContent
        className="h-[min(900px,calc(100dvh-32px))] max-w-[min(1120px,calc(100vw-32px))] gap-0 overflow-hidden rounded-[28px] border-border/80 bg-background p-0 shadow-[0_32px_100px_-32px_rgba(0,0,0,.6)]"
        aria-label="Credits"
      >
        <DialogTitle className="sr-only">Credits</DialogTitle>
        <DialogDescription className="sr-only">
          View your balance, buy credits, and review usage.
        </DialogDescription>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
