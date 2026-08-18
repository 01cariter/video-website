'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Coins } from 'lucide-react';

export default function StudioCreditPill() {
  const [balance, setBalance] = useState<number | null>(null);

  const refresh = useCallback(async (event?: Event) => {
    if (event instanceof CustomEvent && typeof event.detail === 'number') {
      setBalance(event.detail);
      return;
    }
    try {
      const response = await fetch('/api/credits', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        wallet?: { balance?: number };
      };
      if (typeof payload.wallet?.balance === 'number') {
        setBalance(payload.wallet.balance);
      }
    } catch {
      // Keep the canvas usable while account data is unavailable.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    window.addEventListener('credits:changed', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('credits:changed', refresh);
    };
  }, [refresh]);

  if (balance === null) return null;
  return (
    <Link
      href="/credits"
      className="inline-flex h-6 items-center gap-1 rounded-full bg-secondary px-2 text-[11px] font-semibold tabular-nums hover:bg-accent"
      aria-label={`${balance} credits, open top-up page`}
    >
      <Coins className="size-3" />
      {balance}
    </Link>
  );
}
