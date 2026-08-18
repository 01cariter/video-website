'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Coins,
  History,
  ImageIcon,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Type,
  Video,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { MotionTabs } from '@/app/components/ui/motion-tabs';
import { Slider } from '@/app/components/ui/slider';
import {
  CreditHistoryDialog,
  creditEntryLabel,
  type CreditLedgerItem,
} from './CreditHistoryDialog';
import { HolographicWalletCard } from './HolographicWalletCard';
import {
  CUSTOM_CREDIT_MAX,
  CUSTOM_CREDIT_MIN,
  CUSTOM_CREDIT_PACKAGE_ID,
  CUSTOM_CREDIT_STEP,
  customCreditPriceCents,
} from '@/lib/credits/packages';
import { cn } from '@/lib/utils';

interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_cents: number;
  currency: string;
}

interface CreditPayload {
  wallet: {
    balance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
    ledger: CreditLedgerItem[];
  };
  packages: CreditPackage[];
  costs: {
    agent: number;
    text: number;
    image: number;
    video480PerSecond: number;
    video720PerSecond: number;
    videoAudioPerSecond: number;
  };
}

const PACKAGE_NOTES: Record<string, string> = {
  'credits-10': 'Try the workflow',
  'credits-100': 'A small project',
  'credits-1000': 'Regular creation',
  'credits-5000': 'High-volume work',
};

const TOP_UP_TABS = [
  { value: 'packs', label: 'Credit packs', icon: WalletCards },
  { value: 'custom', label: 'Custom amount', icon: Coins },
] as const;

function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function clampCustomCredits(value: number) {
  if (!Number.isFinite(value)) return CUSTOM_CREDIT_MIN;
  return Math.min(
    CUSTOM_CREDIT_MAX,
    Math.max(CUSTOM_CREDIT_MIN, Math.round(value)),
  );
}

export default function CreditsPage() {
  const [payload, setPayload] = useState<CreditPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState('credits-1000');
  const [topUpMode, setTopUpMode] =
    useState<(typeof TOP_UP_TABS)[number]['value']>('packs');
  const [customCredits, setCustomCredits] = useState(2500);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [checkoutSuccess] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('checkout') === 'success',
  );

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/credits', { cache: 'no-store' });
      if (response.status === 401) {
        setUnauthorized(true);
        setPayload(null);
        return;
      }
      const next = (await response.json()) as CreditPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || 'Could not load credits.');
      setPayload(next);
      setUnauthorized(false);
      setError('');
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load credits.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('checkout');
    const initial = window.setTimeout(() => void load(), 0);
    if (status !== 'success') {
      return () => window.clearTimeout(initial);
    }
    const timer = window.setInterval(() => void load(), 1600);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [load]);

  async function checkout(packageId: string, credits?: number) {
    setPurchasing(packageId);
    setError('');
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, credits }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error || 'Could not open Stripe Checkout.');
      }
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Could not open Stripe Checkout.',
      );
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <div className="credits-page grid min-h-[70dvh] place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-label="Loading credits" />
      </div>
    );
  }

  if (unauthorized) {
    return <CreditsGuest />;
  }

  if (!payload) {
    return (
      <div className="credits-page grid min-h-[70dvh] place-items-center px-5 text-center text-destructive">
        {error || 'Could not load credits.'}
      </div>
    );
  }

  const fixedPackages = payload.packages.filter(
    (item) => item.id !== CUSTOM_CREDIT_PACKAGE_ID,
  );
  const customPackage = payload.packages.find(
    (item) => item.id === CUSTOM_CREDIT_PACKAGE_ID,
  );
  const selectedPackage =
    fixedPackages.find((item) => item.id === selectedPackageId) ??
    fixedPackages[0];
  const customPrice = customCreditPriceCents(customCredits);

  return (
    <main className="credits-page relative min-h-full overflow-hidden">
      <div className="credits-page-glow" aria-hidden />
      <div className="relative mx-auto w-full max-w-[1180px] px-8 pb-20 pt-10 max-md:px-4 max-md:pt-7">
        <header className="flex items-center justify-between gap-5">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Snackd / Credits
          </p>
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground max-sm:hidden">
            <ShieldCheck className="size-3.5" />
            Checkout secured by Stripe
          </span>
        </header>

        {checkoutSuccess ? (
          <div className="mb-5 flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium">
            <CheckCircle2 className="size-4" />
            Payment returned. Credits will appear after Stripe confirms the webhook.
          </div>
        ) : null}
        {error ? (
          <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        ) : null}

        <HolographicWalletCard
          className="mt-8"
          balance={payload.wallet.balance}
          lifetimeEarned={payload.wallet.lifetimeEarned}
          lifetimeSpent={payload.wallet.lifetimeSpent}
        />

        <section className="mt-14 rounded-[28px] border bg-card p-6 max-sm:p-5">
          <div className="flex items-start justify-between gap-5 max-sm:flex-col">
            <div>
              <span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Top up
              </span>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em]">
                Add credits
              </h1>
            </div>
            <MotionTabs
              value={topUpMode}
              items={TOP_UP_TABS}
              ariaLabel="Top-up type"
              onValueChange={setTopUpMode}
              className="max-sm:w-full"
            />
          </div>

          {topUpMode === 'packs' ? (
            <div className="mt-7">
              <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {fixedPackages.map((item) => {
                  const selected = item.id === selectedPackage?.id;
                  const estimatedImages = Math.max(
                    1,
                    Math.floor(item.credits / payload.costs.image),
                  );
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        'group relative flex min-h-[174px] flex-col rounded-[20px] border p-4 text-left transition-[background-color,border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground shadow-[0_18px_42px_-30px_rgba(154,63,28,.72)]'
                          : 'bg-background hover:border-primary/40 hover:shadow-[0_16px_36px_-34px_rgba(82,43,24,.5)]',
                      )}
                      aria-pressed={selected}
                      onClick={() => setSelectedPackageId(item.id)}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span
                          className={cn(
                            'text-[10px] font-semibold tracking-[0.14em] uppercase',
                            selected
                              ? 'text-primary-foreground/60'
                              : 'text-muted-foreground',
                          )}
                        >
                          {item.name}
                        </span>
                        <span
                          className={cn(
                            'grid size-5 place-items-center rounded-full border',
                            selected &&
                              'border-primary-foreground/80 bg-primary-foreground text-primary',
                          )}
                        >
                          {selected ? <Check className="size-3" /> : null}
                        </span>
                      </span>
                      <strong className="mt-5 block text-[30px] leading-none font-semibold tracking-[-0.055em] tabular-nums">
                        {item.credits.toLocaleString()}
                      </strong>
                      <span
                        className={cn(
                          'mt-1 text-xs',
                          selected
                            ? 'text-primary-foreground/60'
                            : 'text-muted-foreground',
                        )}
                      >
                        {PACKAGE_NOTES[item.id] || `${estimatedImages} images`}
                      </span>
                      <span className="mt-auto flex items-end justify-between gap-3 pt-5">
                        <b className="text-lg font-semibold tabular-nums">
                          {money(item.price_cents, item.currency)}
                        </b>
                        <ArrowUpRight
                          className={cn(
                            'size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
                            selected
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground',
                          )}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between gap-5 border-t pt-5 max-sm:flex-col max-sm:items-stretch">
                <div>
                  <span className="text-xs text-muted-foreground">
                    Selected pack
                  </span>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {selectedPackage
                      ? `${selectedPackage.credits.toLocaleString()} credits · ${money(
                          selectedPackage.price_cents,
                          selectedPackage.currency,
                        )}`
                      : 'No package available'}
                  </p>
                </div>
                <Button
                  type="button"
                  className="h-11 min-w-48 rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90"
                  disabled={!selectedPackage || Boolean(purchasing)}
                  onClick={() =>
                    selectedPackage && void checkout(selectedPackage.id)
                  }
                >
                  {purchasing === selectedPackage?.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ArrowRight />
                  )}
                  Continue to Stripe
                </Button>
              </div>
            </div>
          ) : customPackage ? (
            <div className="mt-7">
              <div className="rounded-[20px] bg-secondary/65 p-6 max-sm:p-5">
                <div className="flex items-start justify-between gap-4 max-sm:flex-col">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Credit amount
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="rounded-xl"
                        aria-label="Decrease custom credits"
                        onClick={() =>
                          setCustomCredits((current) =>
                            clampCustomCredits(current - CUSTOM_CREDIT_STEP),
                          )
                        }
                      >
                        <Minus />
                      </Button>
                      <div className="relative w-[240px] max-w-full">
                        <Input
                          type="number"
                          min={CUSTOM_CREDIT_MIN}
                          max={CUSTOM_CREDIT_MAX}
                          step={CUSTOM_CREDIT_STEP}
                          value={customCredits}
                          className="h-11 rounded-xl pr-16 text-lg font-semibold tabular-nums"
                          onChange={(event) =>
                            setCustomCredits(
                              clampCustomCredits(Number(event.target.value)),
                            )
                          }
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          credits
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="rounded-xl"
                        aria-label="Increase custom credits"
                        onClick={() =>
                          setCustomCredits((current) =>
                            clampCustomCredits(current + CUSTOM_CREDIT_STEP),
                          )
                        }
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right max-sm:text-left">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <strong className="mt-1 block text-3xl tracking-[-0.05em] tabular-nums">
                      {money(customPrice)}
                    </strong>
                  </div>
                </div>
                <Slider
                  className="mt-8"
                  min={CUSTOM_CREDIT_MIN}
                  max={CUSTOM_CREDIT_MAX}
                  step={CUSTOM_CREDIT_STEP}
                  value={[customCredits]}
                  onValueChange={(value) =>
                    setCustomCredits(clampCustomCredits(value[0] ?? 2500))
                  }
                />
                <div className="mt-3 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>{CUSTOM_CREDIT_MIN.toLocaleString()}</span>
                  <span>{CUSTOM_CREDIT_MAX.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between gap-5 border-t pt-5 max-sm:flex-col max-sm:items-stretch">
                <p className="text-sm text-muted-foreground">
                  About{' '}
                  <span className="font-medium text-foreground tabular-nums">
                    {Math.floor(customCredits / payload.costs.image)}
                  </span>{' '}
                  image generations at the current rate.
                </p>
                <Button
                  type="button"
                  className="h-11 min-w-48 rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90"
                  disabled={Boolean(purchasing)}
                  onClick={() =>
                    void checkout(CUSTOM_CREDIT_PACKAGE_ID, customCredits)
                  }
                >
                  {purchasing === CUSTOM_CREDIT_PACKAGE_ID ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ArrowRight />
                  )}
                  Continue to Stripe
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-8 text-sm text-muted-foreground">
              Custom top-ups are currently unavailable.
            </p>
          )}
        </section>

        <section className="mt-5 rounded-[20px] border bg-card px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Usage
              </span>
              <h2 className="mt-0.5 text-base font-semibold tracking-[-0.02em]">
                Generation rates
              </h2>
            </div>
            <span className="text-xs text-muted-foreground max-md:hidden">
              Failed generations are refunded automatically.
            </span>
          </div>
          <div className="mt-4 grid grid-cols-5 divide-x rounded-2xl bg-secondary/45 max-lg:grid-cols-3 max-lg:divide-x-0 max-sm:grid-cols-2">
            <CostChip
              icon={Sparkles}
              label="Agent"
              value={`${payload.costs.agent} / request`}
            />
            <CostChip
              icon={Type}
              label="Text"
              value={`${payload.costs.text} / request`}
            />
            <CostChip
              icon={ImageIcon}
              label="Image"
              value={`${payload.costs.image} / image`}
            />
            <CostChip
              icon={Video}
              label="Video 480p"
              value={`${payload.costs.video480PerSecond} / sec`}
            />
            <CostChip
              icon={Video}
              label="Video 720p"
              value={`${payload.costs.video720PerSecond} / sec`}
            />
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[22px] border bg-card">
          <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
            <div>
              <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Activity
              </span>
              <h2 className="mt-0.5 text-base font-semibold tracking-[-0.02em]">
                Credit history
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-xl px-3 text-xs"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="size-3.5" />
              View all
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
          {payload.wallet.ledger.length ? (
            <div className="divide-y">
              {payload.wallet.ledger.slice(0, 4).map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[minmax(0,1fr)_92px_116px] items-center gap-5 px-5 py-3 max-sm:grid-cols-[minmax(0,1fr)_72px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {creditEntryLabel(entry.type)}
                    </p>
                    <time
                      className="mt-0.5 block text-xs text-muted-foreground"
                      dateTime={entry.createdAt}
                    >
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
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
              ))}
            </div>
          ) : (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No credit activity yet.
            </p>
          )}
        </section>

        <CreditHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        />
      </div>
    </main>
  );
}

function CreditsGuest() {
  return (
    <main className="credits-page relative min-h-[70dvh] overflow-hidden">
      <div className="credits-page-glow" aria-hidden />
      <div className="relative mx-auto grid min-h-[70dvh] w-full max-w-[1040px] grid-cols-[minmax(0,1fr)_410px] items-center gap-14 px-8 py-14 max-lg:grid-cols-1 max-md:px-4">
        <div className="max-w-[590px]">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Snackd / Credits
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
            Credits
          </h1>
          <p className="mt-3 max-w-[540px] text-[15px] leading-7 text-muted-foreground">
            Sign in to view your balance, buy one-time credit packs, and review
            Agent, image, video, and text generation activity.
          </p>
          <div className="mt-7 grid max-w-[520px] gap-2.5 text-sm">
            <GuestFeature text="One-time credit packs with no recurring charge" />
            <GuestFeature text="Stripe-hosted checkout" />
            <GuestFeature text="Automatic credit refunds for failed generations" />
          </div>
        </div>

        <section className="rounded-[26px] border bg-card p-7 shadow-[0_28px_70px_-50px_rgba(0,0,0,.55)]">
          <span className="grid size-11 place-items-center rounded-2xl bg-secondary">
            <WalletCards className="size-5" />
          </span>
          <h2 className="mt-8 text-xl font-semibold tracking-[-0.025em]">
            Your wallet is private
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to load your balance and purchase history.
          </p>
          <Button
            asChild
            className="mt-8 h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/login?next=/credits">
              Sign in
              <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="mt-2 h-11 w-full rounded-xl bg-transparent"
          >
            <Link href="/register?next=/credits">Sign up</Link>
          </Button>
        </section>
      </div>
    </main>
  );
}

function GuestFeature({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-5 place-items-center rounded-full bg-secondary">
        <Check className="size-3" />
      </span>
      {text}
    </span>
  );
}

function CostChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-3 py-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-background">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{label}</span>
        <b className="mt-0.5 block text-[11px] font-medium text-muted-foreground tabular-nums">
          {value}
        </b>
      </span>
    </div>
  );
}
