import 'server-only';

import { sql } from '@/lib/db';
import {
  CREDIT_COSTS,
  WELCOME_CREDITS,
  type MeteredAiKind,
} from './config';

interface CreditBalanceRow extends Record<string, unknown> {
  balance: number | string;
  lifetime_earned: number | string;
  lifetime_spent: number | string;
}

interface CreditLedgerRow extends Record<string, unknown> {
  id: string;
  amount: number | string;
  balance_after: number | string;
  entry_type: string;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreditPackage extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_cents: number;
  currency: string;
  stripe_price_id: string | null;
}

interface BeginRequestRow extends Record<string, unknown> {
  request_status: 'pending' | 'completed' | 'failed';
  balance: number | string;
  result: Record<string, unknown> | null;
  accepted: boolean;
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('INSUFFICIENT_CREDITS');
    this.name = 'InsufficientCreditsError';
  }
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isInsufficient(error: unknown) {
  return (
    error instanceof Error &&
    /INSUFFICIENT_CREDITS|insufficient credits/i.test(error.message)
  );
}

export async function ensureCreditAccount(userId: string) {
  await sql`
    SELECT *
    FROM public.apply_credit_delta(
      ${userId},
      ${WELCOME_CREDITS},
      ${'welcome'},
      ${`welcome:${userId}`},
      ${userId},
      ${JSON.stringify({ source: 'signup' })}::jsonb
    )
  `;
  await sql`
    SELECT public.refund_stale_ai_generation_requests(${userId})
  `;
}

export async function getCreditPackages() {
  return sql<CreditPackage[]>`
    SELECT id, name, description, credits, price_cents, currency, stripe_price_id
    FROM public.credit_packages
    WHERE active = true
    ORDER BY sort_order, price_cents
  `;
}

export async function getCreditPackage(id: string) {
  const [item] = await sql<CreditPackage[]>`
    SELECT id, name, description, credits, price_cents, currency, stripe_price_id
    FROM public.credit_packages
    WHERE id = ${id} AND active = true
  `;
  return item || null;
}

export async function getCreditWallet(userId: string) {
  await ensureCreditAccount(userId);
  const [account] = await sql<CreditBalanceRow[]>`
    SELECT balance, lifetime_earned, lifetime_spent
    FROM public.credit_accounts
    WHERE user_id = ${userId}
  `;
  const ledger = await sql<CreditLedgerRow[]>`
    SELECT id, amount, balance_after, entry_type, reference_id, metadata, created_at
    FROM public.credit_ledger
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 30
  `;
  return {
    balance: numeric(account?.balance),
    lifetimeEarned: numeric(account?.lifetime_earned),
    lifetimeSpent: numeric(account?.lifetime_spent),
    ledger: ledger.map((entry) => ({
      id: entry.id,
      amount: numeric(entry.amount),
      balanceAfter: numeric(entry.balance_after),
      type: entry.entry_type,
      referenceId: entry.reference_id,
      metadata: entry.metadata,
      createdAt: entry.created_at,
    })),
  };
}

export async function beginMeteredRequest(input: {
  userId: string;
  requestId: string;
  kind: MeteredAiKind;
  cost: number;
  projectId?: string;
  nodeId?: string;
}) {
  await ensureCreditAccount(input.userId);
  try {
    const [row] = await sql<BeginRequestRow[]>`
      SELECT *
      FROM public.begin_ai_generation_request(
        ${input.userId},
        ${input.requestId},
        ${input.kind},
        ${Math.max(1, Math.round(input.cost))},
        ${input.projectId || null},
        ${input.nodeId || null}
      )
    `;
    if (!row) throw new Error('Could not start the metered request.');
    return {
      status: row.request_status,
      balance: numeric(row.balance),
      result: row.result,
      accepted: row.accepted,
    };
  } catch (error) {
    if (isInsufficient(error)) throw new InsufficientCreditsError();
    throw error;
  }
}

export async function completeMeteredRequest(input: {
  userId: string;
  requestId: string;
  result: Record<string, unknown>;
}) {
  await sql`
    SELECT public.complete_ai_generation_request(
      ${input.userId},
      ${input.requestId},
      ${JSON.stringify(input.result)}::jsonb
    )
  `;
}

export async function failMeteredRequest(input: {
  userId: string;
  requestId: string;
  error: string;
}) {
  const [row] = await sql<{ balance: number | string }[]>`
    SELECT public.fail_ai_generation_request(
      ${input.userId},
      ${input.requestId},
      ${input.error}
    ) AS balance
  `;
  return numeric(row?.balance);
}

export function publicCreditCosts() {
  return {
    agent: CREDIT_COSTS.agent,
    text: CREDIT_COSTS.text,
    image: CREDIT_COSTS.image,
    video480PerSecond: CREDIT_COSTS.video480PerSecond,
    video720PerSecond: CREDIT_COSTS.video720PerSecond,
    videoAudioPerSecond: CREDIT_COSTS.videoAudioPerSecond,
  };
}
