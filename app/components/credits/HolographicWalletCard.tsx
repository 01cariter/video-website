'use client';

import dynamic from 'next/dynamic';
import { Radio, Sparkles, WalletCards } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '../i18n-provider';

const ShaderBackground = dynamic(
  () =>
    import('@/app/components/ui/shader-background').then(
      (module) => module.ShaderBackground,
    ),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#17100c]" />,
  },
);

export function HolographicWalletCard({
  balance,
  lifetimeEarned,
  lifetimeSpent,
  className,
}: {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn('credit-wallet-stage', className)}>
      <section
        className="credit-holo-card"
        aria-label={`${balance.toLocaleString()} available credits`}
      >
        <div className="credit-holo-shader" aria-hidden>
          <ShaderBackground
            variant="grain-gradient"
            colorBack="#130d09"
            colors={['#a63e1d', '#d17b42', '#577c74', '#e0b788']}
            softness={0.76}
            intensity={0.28}
            noise={0.48}
            shape="blob"
            speed={0.22}
            scale={1.24}
            rotation={12}
            fit="cover"
          />
        </div>

        <div className="credit-wallet-content">
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.16em] text-white/72 uppercase">
              <span className="grid size-9 place-items-center rounded-xl border border-white/14 bg-black/15 backdrop-blur-md">
                <WalletCards className="size-4" />
              </span>
              {t('credits.wallet')}
            </span>
            <span className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-white/60 uppercase">
              <Radio className="size-3.5" />
              {t('credits.liveBalance')}
            </span>
          </div>

          <div className="credit-wallet-balance">
            <span className="text-[11px] font-medium tracking-[0.14em] text-white/52 uppercase">
              {t('credits.balance')}
            </span>
            <div className="mt-3 flex items-end justify-center gap-3">
              <strong className="text-[clamp(4.5rem,10vw,7.5rem)] leading-[0.8] font-semibold tracking-[-0.08em] text-white tabular-nums">
                {balance.toLocaleString()}
              </strong>
              <span className="pb-1 text-sm font-medium tracking-[0.04em] text-white/60">
                credits
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-5 border-t border-white/14 pt-5">
            <WalletMetric label="Lifetime added" value={lifetimeEarned} />
            <Sparkles className="mb-1 size-4 text-white/34" />
            <WalletMetric
              label="Lifetime used"
              value={lifetimeSpent}
              align="right"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function WalletMetric({
  label,
  value,
  align = 'left',
}: {
  label: string;
  value: number;
  align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : undefined}>
      <span className="block text-[9px] font-semibold tracking-[0.14em] text-white/44 uppercase">
        {label}
      </span>
      <b className="mt-1.5 block text-base font-medium text-white/86 tabular-nums">
        {value.toLocaleString()}
      </b>
    </div>
  );
}
