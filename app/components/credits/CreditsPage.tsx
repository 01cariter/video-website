'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  ImageIcon,
  Loader2,
  Sparkles,
  Type,
  Video,
} from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';

interface CreditLedgerItem {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  createdAt: string;
}

interface CreditPayload {
  wallet: {
    balance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
    ledger: CreditLedgerItem[];
  };
  packages: Array<{
    id: string;
    name: string;
    description: string | null;
    credits: number;
    price_cents: number;
    currency: string;
  }>;
  costs: {
    agent: number;
    text: number;
    image: number;
    video480PerSecond: number;
    video720PerSecond: number;
    videoAudioPerSecond: number;
  };
}

const ENTRY_LABELS: Record<string, string> = {
  welcome: '新用户赠送',
  top_up: '充值到账',
  ai_agent: 'Agent',
  ai_text: '文本生成',
  ai_image: '图片生成',
  ai_video: '视频生成',
  ai_refund: '失败退款',
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default function CreditsPage() {
  const [payload, setPayload] = useState<CreditPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState<string | null>(null);
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
        return;
      }
      const next = (await response.json()) as CreditPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || '积分加载失败');
      setPayload(next);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '积分加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('checkout');
    const initial = window.setTimeout(() => void load(), 0);
    if (status !== 'success') return;
    const timer = window.setInterval(() => void load(), 1600);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [load]);

  async function checkout(packageId: string) {
    setPurchasing(packageId);
    setError('');
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error || '创建支付页面失败');
      }
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : '创建支付页面失败',
      );
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[60dvh] place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="grid min-h-[60dvh] place-items-center px-5 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>登录后管理积分</CardTitle>
            <CardDescription>
              AI Agent、图片、视频与文本生成都会使用账户积分。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login?next=/credits">登录或创建账户</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="grid min-h-[60dvh] place-items-center text-destructive">
        {error || '积分加载失败'}
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-10 max-md:px-4">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            CreatorStudio
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            积分与充值
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            每次生成先原子扣费；生成失败会自动退回。充值由 Stripe
            托管支付页完成。
          </p>
        </div>
        <Card className="min-w-56 gap-2 border-0 bg-[var(--ink)] px-5 py-4 text-[var(--field)]">
          <span className="text-xs opacity-65">当前可用</span>
          <strong className="flex items-center gap-2 text-3xl tabular-nums">
            <Coins className="size-5 text-[var(--orange)]" />
            {payload.wallet.balance}
          </strong>
        </Card>
      </header>

      {checkoutSuccess ? (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--study)]/25 bg-[var(--study-bg)] px-4 py-3 text-sm font-medium text-[var(--study)]">
          <CheckCircle2 className="size-4" />
          支付已返回，积分会在 Stripe webhook 确认后自动到账。
        </div>
      ) : null}
      {error ? (
        <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold">选择积分包</h2>
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          {payload.packages.map((item, index) => (
            <Card
              key={item.id}
              className="relative gap-5 overflow-hidden rounded-2xl"
            >
              {index === 1 ? (
                <Badge className="absolute top-4 right-4">常用</Badge>
              ) : null}
              <CardHeader>
                <CardTitle>{item.name}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <div className="mb-5 flex items-end justify-between gap-3">
                  <strong className="text-3xl tabular-nums">
                    {item.credits}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">
                      积分
                    </span>
                  </strong>
                  <span className="text-sm font-semibold">
                    {money(item.price_cents, item.currency)}
                  </span>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={Boolean(purchasing)}
                  onClick={() => void checkout(item.id)}
                >
                  {purchasing === item.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Coins />
                  )}
                  前往 Stripe 充值
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)_minmax(320px,.72fr)] gap-6 max-lg:grid-cols-1">
        <Card className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>积分明细</CardTitle>
            <CardDescription>
              累计获得 {payload.wallet.lifetimeEarned}，累计使用{' '}
              {payload.wallet.lifetimeSpent}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {payload.wallet.ledger.length ? (
              payload.wallet.ledger.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 border-b px-6 py-3 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {ENTRY_LABELS[entry.type] || entry.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(entry.createdAt))}
                    </p>
                  </div>
                  <div className="text-right">
                    <b
                      className={
                        entry.amount > 0 ? 'text-[var(--study)]' : undefined
                      }
                    >
                      {entry.amount > 0 ? '+' : ''}
                      {entry.amount}
                    </b>
                    <p className="text-xs text-muted-foreground">
                      余额 {entry.balanceAfter}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                暂无积分记录
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader>
            <CardTitle>生成成本</CardTitle>
            <CardDescription>提交前即可预估，失败自动退款。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <CostRow
              icon={Sparkles}
              label="Agent 对话"
              value={`${payload.costs.agent} / 次`}
            />
            <CostRow
              icon={Type}
              label="文本生成"
              value={`${payload.costs.text} / 次`}
            />
            <CostRow
              icon={ImageIcon}
              label="图片生成"
              value={`${payload.costs.image} / 张`}
            />
            <CostRow
              icon={Video}
              label="视频 480p"
              value={`${payload.costs.video480PerSecond} / 秒`}
            />
            <CostRow
              icon={Video}
              label="视频 720p"
              value={`${payload.costs.video720PerSecond} / 秒`}
            />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function CostRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-card">
        <Icon className="size-4" />
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <b className="text-sm tabular-nums">{value}</b>
    </div>
  );
}
