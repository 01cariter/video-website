import { generateText, Output } from 'ai';
import { getStudioRuntimeConfig } from '@/flags';
import {
  beginMeteredRequest,
  completeMeteredRequest,
  failMeteredRequest,
  InsufficientCreditsError,
} from '@/lib/credits/server';
import { friendlyAiError } from '@/lib/studio/errors';
import {
  estimateStudioLanguageUpstreamUsdMicros,
  expectedStudioCreditsStatus,
  isStudioModelEnabled,
  priceStudioUsage,
  STUDIO_AGENT_GATEWAY_PROVIDER_BY_MODEL,
} from '@/lib/studio/pricing';
import { getAuthUser } from '@/lib/supabase/server';
import { MAX_POST_BODY_LENGTH } from '@/lib/types';
import {
  boundedComposeUsage,
  buildComposePrompt,
  composeCopySchema,
  COMPOSE_ASSIST_MAX_OUTPUT_TOKENS,
  gatewayCostUsdMicros,
  normalizeComposeSource,
  type ComposeAssistBody,
} from './contract';

export const maxDuration = 45;

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: 'Sign in to use AI fill.' },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | ComposeAssistBody
    | null;
  if (!body || (body.mode !== 'quote' && body.mode !== 'generate')) {
    return Response.json({ error: 'Invalid AI fill request.' }, { status: 400 });
  }

  const source = normalizeComposeSource(body);
  const prompt = buildComposePrompt(source);
  const reservedInputTokens = Math.max(
    2_048,
    new TextEncoder().encode(prompt).length + 2_048,
  );

  let quote: ReturnType<typeof priceStudioUsage> | undefined;
  let acceptedRequestId: string | undefined;

  try {
    const runtime = await getStudioRuntimeConfig();
    const modelId = runtime.agentModelId;
    if (!isStudioModelEnabled(modelId, runtime)) {
      return Response.json(
        { error: 'AI fill is temporarily unavailable.' },
        { status: 503 },
      );
    }

    quote = priceStudioUsage({
      modelId,
      upstreamUsdMicros: estimateStudioLanguageUpstreamUsdMicros({
        modelId,
        inputTokens: reservedInputTokens,
        outputTokens: COMPOSE_ASSIST_MAX_OUTPUT_TOKENS,
      }),
      runtime,
    });

    if (body.mode === 'quote') {
      return Response.json({
        ...quote,
        modelId,
      });
    }

    const requestId =
      typeof body.requestId === 'string' ? body.requestId.trim() : '';
    if (!requestId || requestId.length > 160) {
      return Response.json(
        { error: 'Invalid request identifier.' },
        { status: 400 },
      );
    }

    const expectedCreditsStatus = expectedStudioCreditsStatus(
      body.expectedCredits,
      quote,
    );
    if (
      expectedCreditsStatus === 'invalid' ||
      expectedCreditsStatus === 'not-provided'
    ) {
      return Response.json(
        { error: 'Refresh the AI fill price and try again.' },
        { status: 400 },
      );
    }
    if (expectedCreditsStatus === 'changed') {
      return Response.json(
        {
          error: `AI fill now costs ${quote.credits} credits. Review the updated price and try again.`,
          code: 'PRICE_CHANGED',
          ...quote,
          modelId,
        },
        { status: 409 },
      );
    }

    const metered = await beginMeteredRequest({
      userId: user.id,
      requestId,
      kind: 'text',
      cost: quote.credits,
    });
    if (!metered.accepted) {
      if (metered.status === 'completed' && metered.result) {
        return Response.json(metered.result);
      }
      return Response.json(
        {
          error: 'This AI fill is already processing. Try again in a moment.',
          balance: metered.balance,
        },
        { status: 409 },
      );
    }
    acceptedRequestId = requestId;

    const result = await generateText({
      model: modelId,
      output: Output.object({
        name: 'PostDraft',
        description: 'Editable title and body copy for a creator post.',
        schema: composeCopySchema,
      }),
      prompt,
      maxOutputTokens: COMPOSE_ASSIST_MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      abortSignal: request.signal,
      providerOptions: {
        gateway: {
          only: [STUDIO_AGENT_GATEWAY_PROVIDER_BY_MODEL[modelId]],
          user: user.id,
          tags: ['feature:compose-ai-fill'],
        },
        ...(modelId.startsWith('openai/')
          ? { openai: { reasoningEffort: 'low' } }
          : {}),
      },
    });

    const output = result.output;
    const estimatedActualUpstreamUsdMicros =
      estimateStudioLanguageUpstreamUsdMicros({
        modelId,
        inputTokens: boundedComposeUsage(
          result.usage.inputTokens,
          reservedInputTokens,
        ),
        outputTokens: boundedComposeUsage(
          result.usage.outputTokens,
          COMPOSE_ASSIST_MAX_OUTPUT_TOKENS,
        ),
      });
    const actualQuote = priceStudioUsage({
      modelId,
      upstreamUsdMicros:
        gatewayCostUsdMicros(result.finalStep.providerMetadata) ??
        estimatedActualUpstreamUsdMicros,
      runtime,
    });
    // Never charge more than the user approved. Cost-first Gateway routing and
    // the bounded token reserve should keep this branch unreachable; retaining
    // the cap protects an open modal if provider pricing changes mid-request.
    const settledCredits = Math.min(quote.credits, actualQuote.credits);
    const response = {
      title: output.title.trim().slice(0, 120),
      body: output.body.trim().slice(0, MAX_POST_BODY_LENGTH),
      credits: settledCredits,
      upstreamUsdMicros: actualQuote.upstreamUsdMicros,
      markupBps: actualQuote.markupBps,
      pricingVersion: actualQuote.pricingVersion,
      modelId,
    };

    const balance = await completeMeteredRequest({
      userId: user.id,
      requestId,
      result: response,
      actualCost: settledCredits,
    });
    return Response.json({ ...response, balance });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return Response.json(
        {
          error: 'Not enough credits. Top up before using AI fill.',
          code: 'INSUFFICIENT_CREDITS',
          ...(quote ?? {}),
        },
        { status: 402 },
      );
    }

    const message =
      error instanceof Error ? error.message : 'AI fill failed.';
    if (acceptedRequestId) {
      await failMeteredRequest({
        userId: user.id,
        requestId: acceptedRequestId,
        error: message,
      }).catch(() => undefined);
    }
    return Response.json(
      { error: friendlyAiError(message) },
      { status: 502 },
    );
  }
}
