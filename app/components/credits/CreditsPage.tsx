'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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
  creditEntryKey,
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
import type { MessageKey } from '@/lib/i18n/t';
import { useT } from '../i18n-provider';

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
    videoPerSecond: number;
    videoClip: number;
    videoClipSeconds: number;
    videoModelLabel: string;
    videoResolution: string;
  };
}

const PACKAGE_NOTE_KEYS = {
  'credits-10': 'credits.pack.credits-10',
  'credits-100': 'credits.pack.credits-100',
  'credits-1000': 'credits.pack.credits-1000',
  'credits-5000': 'credits.pack.credits-5000',
} as const satisfies Record<string, MessageKey>;

const TOP_UP_TAB_KEYS = [
  { value: 'packs', key: 'credits.packs', icon: WalletCards },
  { value: 'custom', key: 'credits.custom', icon: Coins },
] as const satisfies ReadonlyArray<{ value: string; key: MessageKey; icon: typeof Coins }>;

// Each row is priced from that kind's default model at its default settings,
// so the figures describe what a reader gets without changing anything.
const GENERATION_ESTIMATES = [
  { key: 'agent', label: 'credits.kind.agent', unit: 'credits.unit.steps', icon: Sparkles },
  { key: 'text', label: 'credits.kind.text', unit: 'credits.unit.generations', icon: Type },
  { key: 'image', label: 'common.image', unit: 'credits.unit.images', icon: ImageIcon },
  { key: 'videoPerSecond', label: 'common.video', unit: 'credits.unit.seconds', icon: Video },
] as const satisfies ReadonlyArray<{ key: string; label: MessageKey; unit: MessageKey; icon: typeof Video }>;

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

function paymentError(message?: string) {
  return (message || 'Could not open payment.')
    .replaceAll('Stripe Checkout', 'payment')
    .replaceAll('Stripe', 'Payment');
}

export default function CreditsPage() {
  const t = useT();
  const [payload, setPayload] = useState<CreditPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState('credits-1000');
  const [topUpMode, setTopUpMode] =
    useState<(typeof TOP_UP_TAB_KEYS)[number]['value']>('packs');
  const [customCredits, setCustomCredits] = useState(2500);
  const [historyOpen, setHistoryOpen] = useState(false);
  const topUpTabs = TOP_UP_TAB_KEYS.map((tab) => ({
    value: tab.value,
    label: t(tab.key),
    icon: tab.icon,
  }));
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
      if (!response.ok) throw new Error(next.error || t('credits.loadFailed'));
      setPayload(next);
      setUnauthorized(false);
      setError('');
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('credits.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        throw new Error(paymentError(result.error));
      }
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Could not open payment.',
      );
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <div className="credits-page grid min-h-[70dvh] place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-label={t('credits.loading')} />
      </div>
    );
  }

  if (unauthorized) {
    return <CreditsGuest />;
  }

  if (!payload) {
    return (
      <div className="credits-page grid min-h-[70dvh] place-items-center px-5 text-center text-destructive">
        {error || t('credits.loadFailed')}
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
  // Priced off the live packs so the slider can never quote above a pack.
  const customPrice = customCreditPriceCents(customCredits, fixedPackages);
  const selectedCredits =
    topUpMode === 'packs' ? (selectedPackage?.credits ?? 0) : customCredits;
  const selectedPrice =
    topUpMode === 'packs'
      ? (selectedPackage?.price_cents ?? 0)
      : customPrice;
  const selectedCurrency =
    topUpMode === 'packs' ? selectedPackage?.currency : 'usd';
  const purchaseId =
    topUpMode === 'packs'
      ? selectedPackage?.id
      : customPackage
        ? CUSTOM_CREDIT_PACKAGE_ID
        : undefined;

  return (
    <main className="credits-page relative min-h-full overflow-hidden">
      <div className="relative mx-auto w-full max-w-[1180px] px-8 pb-20 pt-10 max-md:px-4 max-md:pt-7">
        <header>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Snackd / Credits
          </p>
        </header>

        {checkoutSuccess ? (
          <div className="mt-5 mb-5 flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium">
            <CheckCircle2 className="size-4" />
            {t('credits.paymentReceived')}
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
                {t('credits.topUp')}
              </span>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em]">
                {t('credits.add')}
              </h1>
            </div>
            <MotionTabs
              value={topUpMode}
              items={topUpTabs}
              ariaLabel={t('credits.topUpType')}
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
                        {item.id in PACKAGE_NOTE_KEYS
                          ? t(PACKAGE_NOTE_KEYS[item.id as keyof typeof PACKAGE_NOTE_KEYS])
                          : t('credits.packImages', { count: estimatedImages })}
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
            </div>
          ) : customPackage ? (
            <CustomAmountPanel
              credits={customCredits}
              price={customPrice}
              onCreditsChange={setCustomCredits}
            />
          ) : (
            <p className="mt-8 text-sm text-muted-foreground">
              Custom top-ups are currently unavailable.
            </p>
          )}

          {purchaseId ? (
            <>
              <GenerationEstimate
                credits={selectedCredits}
                costs={payload.costs}
              />
              <div className="mt-6 flex items-center justify-between gap-5 border-t pt-5 max-sm:flex-col max-sm:items-stretch">
                <div>
                  <span className="text-xs text-muted-foreground">
                    {topUpMode === 'packs'
                      ? t('credits.selectedPack')
                      : t('credits.custom')}
                  </span>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {t('credits.amountLine', {
                      credits: selectedCredits.toLocaleString(),
                      price: money(selectedPrice, selectedCurrency),
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  className="h-11 min-w-48 rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90"
                  disabled={Boolean(purchasing)}
                  onClick={() =>
                    void checkout(
                      purchaseId,
                      topUpMode === 'custom' ? selectedCredits : undefined,
                    )
                  }
                >
                  {purchasing === purchaseId ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ArrowRight />
                  )}
                  Continue to payment
                </Button>
              </div>
            </>
          ) : null}
        </section>

        <section className="mt-5 overflow-hidden rounded-[22px] border bg-card">
          <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
            <div>
              <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {t('credits.activity')}
              </span>
              <h2 className="mt-0.5 text-base font-semibold tracking-[-0.02em]">
                {t('credits.history')}
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-xl px-3 text-xs"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="size-3.5" />
              {t('credits.viewAll')}
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
                      {(() => {
                        const key = creditEntryKey(entry.type);
                        return key ? t(key) : entry.type;
                      })()}
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
              {t('credits.noActivity')}
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
  const t = useT();
  return (
    <main className="credits-page relative min-h-[70dvh] overflow-hidden">
      <div className="relative mx-auto grid min-h-[70dvh] w-full max-w-[1040px] grid-cols-[minmax(0,1fr)_410px] items-center gap-14 px-8 py-14 max-lg:grid-cols-1 max-md:px-4">
        <div className="max-w-[590px]">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Snackd / Credits
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
            Credits
          </h1>
          <p className="mt-3 max-w-[540px] text-[15px] leading-7 text-muted-foreground">
            {t('credits.guestLead')}
          </p>
          <div className="mt-7 grid max-w-[520px] gap-2.5 text-sm">
            <GuestFeature text={t('credits.guest1')} />
            <GuestFeature text={t('credits.guest2')} />
            <GuestFeature text={t('credits.guest3')} />
          </div>
        </div>

        <section className="rounded-[26px] border bg-card p-7 shadow-[0_28px_70px_-50px_rgba(0,0,0,.55)]">
          <span className="grid size-11 place-items-center rounded-2xl bg-secondary">
            <WalletCards className="size-5" />
          </span>
          <h2 className="mt-8 text-xl font-semibold tracking-[-0.025em]">
            {t('credits.walletPrivate')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('credits.walletPrivateLead')}
          </p>
          <Button
            asChild
            className="mt-8 h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/login?next=/credits">
              {t('common.signIn')}
              <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="mt-2 h-11 w-full rounded-xl bg-transparent"
          >
            <Link href="/register?next=/credits">{t('common.signUp')}</Link>
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

function CustomAmountPanel({
  credits,
  price,
  onCreditsChange,
}: {
  credits: number;
  price: number;
  onCreditsChange: (credits: number) => void;
}) {
  return (
    <div className="mt-7 overflow-hidden rounded-[22px] border bg-background">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(230px,0.42fr)] max-md:grid-cols-1">
        <div className="border-r p-6 max-md:border-r-0 max-md:border-b max-sm:p-5">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Credit amount
          </span>
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12 shrink-0 rounded-2xl bg-card"
              aria-label="Decrease custom credits"
              onClick={() =>
                onCreditsChange(
                  clampCustomCredits(credits - CUSTOM_CREDIT_STEP),
                )
              }
            >
              <Minus />
            </Button>
            <div className="relative min-w-0 flex-1">
              <Input
                type="number"
                min={CUSTOM_CREDIT_MIN}
                max={CUSTOM_CREDIT_MAX}
                step={CUSTOM_CREDIT_STEP}
                value={credits}
                className="h-12 rounded-2xl border-border bg-card px-20 text-center text-xl font-semibold tabular-nums shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                onChange={(event) =>
                  onCreditsChange(
                    clampCustomCredits(Number(event.target.value)),
                  )
                }
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                credits
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12 shrink-0 rounded-2xl bg-card"
              aria-label="Increase custom credits"
              onClick={() =>
                onCreditsChange(
                  clampCustomCredits(credits + CUSTOM_CREDIT_STEP),
                )
              }
            >
              <Plus />
            </Button>
          </div>

          <Slider
            className="mt-8"
            min={CUSTOM_CREDIT_MIN}
            max={CUSTOM_CREDIT_MAX}
            step={CUSTOM_CREDIT_STEP}
            value={[credits]}
            onValueChange={(value) =>
              onCreditsChange(
                clampCustomCredits(value[0] ?? CUSTOM_CREDIT_MIN),
              )
            }
          />
          <div className="mt-3 flex justify-between text-[11px] font-medium text-muted-foreground tabular-nums">
            <span>{CUSTOM_CREDIT_MIN.toLocaleString()}</span>
            <span>{CUSTOM_CREDIT_MAX.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex min-h-[190px] flex-col justify-between bg-secondary/55 p-6 max-sm:min-h-[160px] max-sm:p-5">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Purchase total
          </span>
          <AnimatedValue
            value={price}
            format={(value) => money(value)}
            className="text-[clamp(2.6rem,5vw,4rem)] leading-none font-semibold tracking-[-0.06em]"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            One-time payment. No subscription.
          </p>
        </div>
      </div>
    </div>
  );
}

function GenerationEstimate({
  credits,
  costs,
}: {
  credits: number;
  costs: CreditPayload['costs'];
}) {
  const t = useT();
  return (
    <div className="mt-6 rounded-[20px] border bg-secondary/45 p-4">
      <div className="flex items-end justify-between gap-4 px-1 max-sm:items-start">
        <div>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {t('credits.estimated')}
          </span>
          <h2 className="mt-1 text-sm font-semibold">
            {t('credits.canMake', { credits: credits.toLocaleString() })}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('credits.defaultsNote', {
              model: costs.videoModelLabel,
              resolution: costs.videoResolution,
              seconds: costs.videoClipSeconds,
              clip: costs.videoClip,
            })}
          </p>
        </div>
        <span className="text-xs text-muted-foreground max-sm:hidden">
          {t('credits.refunded')}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 max-lg:grid-cols-2">
        {GENERATION_ESTIMATES.map((item) => {
          const count = Math.floor(credits / costs[item.key]);
          return (
            <GenerationEstimateItem
              key={item.key}
              icon={item.icon}
              label={t(item.label)}
              value={count}
              unit={t(item.unit)}
            />
          );
        })}
      </div>
    </div>
  );
}

function GenerationEstimateItem({
  icon: Icon,
  label,
  unit,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  unit: string;
  value: number;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-background px-3 py-3">
      <span className="grid size-7 place-items-center rounded-lg border bg-card">
        <Icon className="size-3.5" />
      </span>
      <span className="mt-3 block truncate text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 flex min-w-0 items-baseline gap-1">
        <AnimatedValue
          value={value}
          format={(nextValue) => nextValue.toLocaleString()}
          className="text-lg leading-none font-semibold tracking-[-0.03em]"
        />
        <span className="truncate text-[10px] text-muted-foreground">
          {unit}
        </span>
      </span>
    </div>
  );
}

function AnimatedValue({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const reducedMotion = Boolean(useReducedMotion());
  const [motionState, setMotionState] = useState<{
    value: number;
    direction: 1 | -1;
  }>({ value, direction: 1 });
  if (motionState.value !== value) {
    setMotionState({
      value,
      direction: value > motionState.value ? 1 : -1,
    });
  }
  const formattedValue = format(motionState.value);
  const characters = rollingCharacters(formattedValue);

  return (
    <span
      className={cn(
        'inline-flex items-baseline whitespace-nowrap tabular-nums',
        className,
      )}
      aria-label={formattedValue}
    >
      {characters.map((item) =>
        item.digit === null ? (
          <span
            key={item.key}
            className="inline-grid place-items-center leading-none"
            aria-hidden
          >
            {item.character}
          </span>
        ) : (
          <RollingDigit
            key={item.key}
            digit={item.digit}
            direction={motionState.direction}
            place={item.place}
            reducedMotion={reducedMotion}
          />
        ),
      )}
    </span>
  );
}

function RollingDigit({
  digit,
  direction,
  place,
  reducedMotion,
}: {
  digit: number;
  direction: 1 | -1;
  place: number;
  reducedMotion: boolean;
}) {
  if (reducedMotion) {
    return (
      <span className="relative inline-grid place-items-center leading-none">
        <span className="invisible" aria-hidden>
          {digit}
        </span>
        <span className="absolute inset-0 grid place-items-center" aria-hidden>
          {digit}
        </span>
      </span>
    );
  }

  return (
    <span className="relative inline-grid place-items-center leading-none">
      <span className="invisible" aria-hidden>
        {digit}
      </span>
      <span
        className="absolute inset-x-0 top-1/2 h-[1.12em] -translate-y-1/2 overflow-hidden"
        aria-hidden
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.span
            key={digit}
            custom={direction}
            variants={ROLLING_DIGIT_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: 0.34,
              delay: Math.min(place * 0.025, 0.1),
              ease: [0.16, 1, 0.3, 1],
            }}
            className="absolute inset-0 grid place-items-center leading-none"
          >
            {digit}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}

const ROLLING_DIGIT_VARIANTS = {
  enter: (direction: 1 | -1) => ({
    y: direction > 0 ? '105%' : '-105%',
    opacity: 0,
  }),
  center: {
    y: '0%',
    opacity: 1,
  },
  exit: (direction: 1 | -1) => ({
    y: direction > 0 ? '-105%' : '105%',
    opacity: 0,
  }),
};

function rollingCharacters(value: string) {
  let place = 0;
  let symbol = 0;

  return Array.from(value)
    .reverse()
    .map((character) => {
      const digit =
        character >= '0' && character <= '9' ? Number(character) : null;
      if (digit !== null) {
        const item = {
          key: `digit-${place}`,
          character,
          digit,
          place,
        };
        place += 1;
        return item;
      }
      const item = {
        key: `symbol-${place}-${symbol}-${character}`,
        character,
        digit: null,
        place,
      };
      symbol += 1;
      return item;
    })
    .reverse();
}
