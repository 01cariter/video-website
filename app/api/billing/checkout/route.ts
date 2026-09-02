import { NextResponse } from 'next/server';
import { getPublicSiteUrl, getStripe } from '@/lib/billing/stripe';
import {
  ensureCreditAccount,
  getCreditPackage,
  getCreditPackages,
} from '@/lib/credits/server';
import {
  CUSTOM_CREDIT_PACKAGE_ID,
  customCreditPriceCents,
  isValidCustomCreditAmount,
} from '@/lib/credits/packages';
import { sql } from '@/lib/db';
import { getAuthUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface OrderRow extends Record<string, unknown> {
  id: string;
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    packageId?: string;
    credits?: number;
  } | null;
  const packageId = body?.packageId?.trim();
  if (!packageId) {
    return NextResponse.json({ error: 'Choose a credit pack.' }, { status: 400 });
  }
  const creditPackage = await getCreditPackage(packageId);
  if (!creditPackage) {
    return NextResponse.json({ error: 'This credit pack is unavailable.' }, { status: 404 });
  }
  const customCredits = Number(body?.credits);
  if (
    creditPackage.id === CUSTOM_CREDIT_PACKAGE_ID &&
    !isValidCustomCreditAmount(customCredits)
  ) {
    return NextResponse.json(
      { error: 'Custom credits must be a whole number between 100 and 50,000.' },
      { status: 400 },
    );
  }
  const orderCredits =
    creditPackage.id === CUSTOM_CREDIT_PACKAGE_ID
      ? customCredits
      : creditPackage.credits;
  // Custom amounts are priced off the live pack ladder, so the checkout total
  // always matches what the slider showed.
  const orderPriceCents =
    creditPackage.id === CUSTOM_CREDIT_PACKAGE_ID
      ? customCreditPriceCents(
          customCredits,
          (await getCreditPackages()).filter(
            (item) => item.id !== CUSTOM_CREDIT_PACKAGE_ID,
          ),
        )
      : creditPackage.price_cents;

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
        ${orderPriceCents},
        ${creditPackage.currency},
        ${orderCredits}
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
        billing_address_collection: 'auto',
        line_items: [
          creditPackage.stripe_price_id &&
          creditPackage.id !== CUSTOM_CREDIT_PACKAGE_ID
            ? {
                price: creditPackage.stripe_price_id,
                quantity: 1,
              }
            : {
                price_data: {
                  currency: creditPackage.currency,
                  unit_amount: orderPriceCents,
                  product_data: {
                    name: `${creditPackage.name} · ${orderCredits} credits`,
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
          credits: String(orderCredits),
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
      error instanceof Error ? error.message : 'Could not create the checkout session.';
    const notConfigured = /STRIPE_SECRET_KEY/.test(message);
    return NextResponse.json(
      {
        error: notConfigured
          ? 'Stripe is not configured. Add STRIPE_SECRET_KEY first.'
          : 'Could not create the checkout session. Try again shortly.',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: notConfigured ? 503 : 502 },
    );
  }
}
