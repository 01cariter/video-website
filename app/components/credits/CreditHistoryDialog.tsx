'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useT } from '../i18n-provider';
import type { MessageKey } from '@/lib/i18n/t';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';

export interface CreditLedgerItem {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  createdAt: string;
}

interface CreditLedgerPage {
  items: CreditLedgerItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 8;

const ENTRY_KEYS: Record<string, MessageKey> = {
  welcome: 'credits.entry.welcome',
  top_up: 'credits.entry.purchase',
  ai_agent: 'credits.entry.agent',
  ai_text: 'credits.entry.text',
  ai_image: 'credits.entry.image',
  ai_video: 'credits.entry.video',
  ai_refund: 'credits.entry.refund',
};

/** Falls back to the raw ledger type, which is never shown for a known kind. */
export function creditEntryKey(type: string): MessageKey | null {
  return ENTRY_KEYS[type] ?? null;
}

export function CreditHistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CreditLedgerPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPage = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/credits/ledger?page=${nextPage}&pageSize=${PAGE_SIZE}`,
        { cache: 'no-store' },
      );
      const result = (await response.json()) as CreditLedgerPage & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || t('credits.historyFailed'));
      }
      setData(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('credits.historyFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadPage(page), 0);
    return () => window.clearTimeout(timer);
  }, [loadPage, open, page]);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) setPage(1);
  }

  const start = data?.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const end = data?.total
    ? Math.min(data.page * data.pageSize, data.total)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[84dvh] gap-0 overflow-hidden rounded-[24px] p-0 sm:max-w-[760px]">
        <DialogHeader className="border-b px-6 py-5 pr-14 text-left">
          <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            <History className="size-3.5" />
            Activity
          </span>
          <DialogTitle className="text-xl tracking-[-0.025em]">
            {t('credits.history')}
          </DialogTitle>
          <DialogDescription>
            {t('credits.historyLead')}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[420px] overflow-y-auto">
          {loading && !data ? (
            <div className="grid min-h-[420px] place-items-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-label={t('credits.historyLoading')} />
            </div>
          ) : error ? (
            <div className="grid min-h-[420px] place-items-center px-6 text-center">
              <div>
                <p className="text-sm font-medium">{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-xl"
                  onClick={() => void loadPage(page)}
                >
                  {t('common.tryAgain')}
                </Button>
              </div>
            </div>
          ) : data?.items.length ? (
            <div className="divide-y">
              {data.items.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">
              {t('credits.noActivity')}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-4 border-t bg-secondary/35 px-6 py-4">
          <span className="text-xs text-muted-foreground tabular-nums">
            {data?.total ? `${start}–${end} of ${data.total}` : '0 entries'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-xl bg-background"
              aria-label={t('credits.previousPage')}
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-16 text-center text-xs font-medium tabular-nums">
              {data ? `${data.page} / ${data.totalPages}` : '1 / 1'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-xl bg-background"
              aria-label={t('credits.nextPage')}
              disabled={loading || !data || page >= data.totalPages}
              onClick={() =>
                setPage((current) =>
                  data ? Math.min(data.totalPages, current + 1) : current,
                )
              }
            >
              <ChevronRight />
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function HistoryRow({ entry }: { entry: CreditLedgerItem }) {
  const t = useT();
  const key = creditEntryKey(entry.type);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_92px_116px] items-center gap-5 px-6 py-4 max-sm:grid-cols-[minmax(0,1fr)_72px]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {key ? t(key) : entry.type}
        </p>
        <time
          className="mt-0.5 block text-xs text-muted-foreground"
          dateTime={entry.createdAt}
        >
          {new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(entry.createdAt))}
        </time>
      </div>
      <b className="text-right text-sm tabular-nums">
        {entry.amount > 0 ? '+' : ''}
        {entry.amount}
      </b>
      <span className="text-right text-xs text-muted-foreground tabular-nums max-sm:hidden">
        Balance {entry.balanceAfter}
      </span>
    </div>
  );
}
