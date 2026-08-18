import type Stripe from 'stripe';
import { getStripe, getStripeWebhookSecret } from '@/lib/billing/stripe';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

interface OrderRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  status: string;
}

async function processCheckout(
  session: Stripe.Checkout.Session,
  eventId: string,
) {
  const orderId = session.metadata?.orderId;
  if (!orderId) throw new Error('Stripe session is missing orderId metadata.');
  const [order] = await sql<OrderRow[]>`
    SELECT id, user_id, amount_cents, currency, status
    FROM public.credit_orders
    WHERE id = ${orderId}::uuid
    FOR UPDATE
  `;
  if (!order) throw new Error('Credit order does not exist.');
  if (session.metadata?.userId !== order.user_id) {
    throw new Error('Stripe user metadata does not match the order.');
  }
  if (
    session.amount_total !== order.amount_cents ||
    session.currency?.toLowerCase() !== order.currency.toLowerCase()
  ) {
    throw new Error('Stripe amount or currency does not match the order.');
  }
  if (session.payment_status !== 'paid') {
    throw new Error('Stripe Checkout session is not paid.');
  }
  await sql`
    SELECT *
    FROM public.fulfill_credit_order(
      ${order.id}::uuid,
      ${eventId},
      ${typeof session.payment_intent === 'string' ? session.payment_intent : null}
    )
  `;
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return Response.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? `Invalid Stripe webhook: ${error.message}`
            : 'Invalid Stripe webhook.',
      },
      { status: 400 },
    );
  }

  const inserted = await sql<{ provider_event_id: string }[]>`
    INSERT INTO public.billing_events (
      provider_event_id, provider, event_type, payload
    )
    VALUES (
      ${event.id},
      ${'stripe'},
      ${event.type},
      ${JSON.stringify(event)}::jsonb
    )
    ON CONFLICT (provider_event_id) DO NOTHING
    RETURNING provider_event_id
  `;
  if (!inserted.length) return Response.json({ received: true, duplicate: true });

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        await processCheckout(session, event.id);
      }
    } else if (event.type === 'checkout.session.async_payment_succeeded') {
      await processCheckout(event.data.object, event.id);
    } else if (
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await sql`
          UPDATE public.credit_orders
          SET status = ${
            event.type === 'checkout.session.expired' ? 'expired' : 'failed'
          }, updated_at = now()
          WHERE id = ${orderId}::uuid AND status = 'pending'
        `;
      }
    }
    return Response.json({ received: true });
  } catch (error) {
    await sql`
      DELETE FROM public.billing_events
      WHERE provider_event_id = ${event.id}
    `.catch(() => undefined);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Stripe event processing failed.',
      },
      { status: 500 },
    );
  }
}
