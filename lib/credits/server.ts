import 'server-only';

import { sql, sqlJson } from '@/lib/db';
import { decodeJsonb } from '@/lib/jsonb';
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
  metadata: Record<string, unknown> | string;
  created_at: string;
}

interface CreditLedgerCountRow extends Record<string, unknown> {
  count: number | string;
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
  result: Record<string, unknown> | string | null;
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

function mapCreditLedgerRow(entry: CreditLedgerRow) {
  return {
    id: entry.id,
    amount: numeric(entry.amount),
    balanceAfter: numeric(entry.balance_after),
    type: entry.entry_type,
    referenceId: entry.reference_id,
    metadata: decodeJsonb<Record<string, unknown>>(entry.metadata, {}),
    createdAt: entry.created_at,
  };
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
      ${sqlJson({ source: 'signup' })}
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
    ledger: ledger.map(mapCreditLedgerRow),
  };
}

export async function getCreditLedgerPage(
  userId: string,
  page: number,
  pageSize: number,
) {
  await ensureCreditAccount(userId);
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const offset = (safePage - 1) * safePageSize;
  const [[countRow], rows] = await Promise.all([
    sql<CreditLedgerCountRow[]>`
      SELECT count(*) AS count
      FROM public.credit_ledger
      WHERE user_id = ${userId}
    `,
    sql<CreditLedgerRow[]>`
      SELECT id, amount, balance_after, entry_type, reference_id, metadata, created_at
      FROM public.credit_ledger
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${safePageSize}
      OFFSET ${offset}
    `,
  ]);
  const total = numeric(countRow?.count);
  return {
    items: rows.map(mapCreditLedgerRow),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
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
      result: decodeJsonb<Record<string, unknown> | null>(row.result, null),
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
  actualCost?: number;
}) {
  if (input.actualCost !== undefined) {
    const [row] = await sql<{ balance: number | string }[]>`
      SELECT public.complete_metered_ai_generation_request(
        ${input.userId},
        ${input.requestId},
        ${sqlJson(input.result)},
        ${Math.max(1, Math.round(input.actualCost))}
      ) AS balance
    `;
    return numeric(row?.balance);
  }
  await sql`
    SELECT public.complete_ai_generation_request(
      ${input.userId},
      ${input.requestId},
      ${sqlJson(input.result)}
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
    videoPerSecond: CREDIT_COSTS.videoPerSecond,
    videoClip: CREDIT_COSTS.videoClip,
    videoClipSeconds: CREDIT_COSTS.videoClipSeconds,
    videoModelLabel: CREDIT_COSTS.videoModelLabel,
    videoResolution: CREDIT_COSTS.videoResolution,
  };
}
