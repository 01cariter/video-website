import { NextResponse } from 'next/server';
import { getPublicSiteUrl, getStripe } from '@/lib/billing/stripe';
import {
  ensureCreditAccount,
  getCreditPackage,
} from '@/lib/credits/server';
import { sql } from '@/lib/db';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface OrderRow extends Record<string, unknown> {
  id: string;
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    packageId?: string;
  } | null;
  const packageId = body?.packageId?.trim();
  if (!packageId) {
    return NextResponse.json({ error: '请选择积分包。' }, { status: 400 });
  }
  const creditPackage = await getCreditPackage(packageId);
  if (!creditPackage) {
    return NextResponse.json({ error: '积分包不存在或已下架。' }, { status: 404 });
  }

  let orderId: string | null = null;
  try {
    await ensureCreditAccount(user.id);
    const [order] = await sql<OrderRow[]>`
      INSERT INTO public.credit_orders (
        user_id, package_id, amount_cents, currency, credits
      )
      VALUES (
        ${user.id},
        ${creditPackage.id},
        ${creditPackage.price_cents},
        ${creditPackage.currency},
        ${creditPackage.credits}
      )
      RETURNING id
    `;
    if (!order) throw new Error('Could not create the credit order.');
    orderId = order.id;

    const stripe = getStripe();
    const siteUrl = getPublicSiteUrl();
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: user.email || undefined,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        line_items: [
          creditPackage.stripe_price_id
            ? {
                price: creditPackage.stripe_price_id,
                quantity: 1,
              }
            : {
                price_data: {
                  currency: creditPackage.currency,
                  unit_amount: creditPackage.price_cents,
                  product_data: {
                    name: `${creditPackage.name} · ${creditPackage.credits} 积分`,
                    description:
                      creditPackage.description ||
                      'Snackd CreatorStudio AI credits',
                  },
                },
                quantity: 1,
              },
        ],
        metadata: {
          orderId,
          userId: user.id,
          packageId: creditPackage.id,
          credits: String(creditPackage.credits),
        },
        payment_intent_data: {
          metadata: {
            orderId,
            userId: user.id,
          },
        },
        success_url: `${siteUrl}/credits?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/credits?checkout=cancelled`,
      },
      { idempotencyKey: `credit-checkout:${orderId}` },
    );
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');

    await sql`
      UPDATE public.credit_orders
      SET stripe_checkout_session_id = ${session.id}, updated_at = now()
      WHERE id = ${orderId}::uuid AND user_id = ${user.id}
    `;
    return NextResponse.json({ url: session.url, orderId });
  } catch (error) {
    if (orderId) {
      await sql`
        UPDATE public.credit_orders
        SET status = 'failed', updated_at = now()
        WHERE id = ${orderId}::uuid AND status = 'pending'
      `.catch(() => undefined);
    }
    const message =
      error instanceof Error ? error.message : '创建支付页面失败。';
    const notConfigured = /STRIPE_SECRET_KEY/.test(message);
    return NextResponse.json(
      {
        error: notConfigured
          ? 'Stripe 尚未配置。请先添加 STRIPE_SECRET_KEY。'
          : '创建支付页面失败，请稍后重试。',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: notConfigured ? 503 : 502 },
    );
  }
}
