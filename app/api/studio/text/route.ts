import { generateText } from 'ai';
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
  isStudioAgentModelId,
  isStudioModelEnabled,
  priceStudioUsage,
  STUDIO_AGENT_GATEWAY_PROVIDER_BY_MODEL,
} from '@/lib/studio/pricing';
import {
  normalizeStudioTextRequest,
  StudioTextValidationError,
} from '@/lib/studio/text-generation';
import { getAuthUser } from '@/lib/supabase/server';

export const maxDuration = 45;

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: 'Sign in to generate text.' },
      { status: 401 },
    );
  }
  let body: ReturnType<typeof normalizeStudioTextRequest>;
  try {
    body = normalizeStudioTextRequest(await request.json().catch(() => null));
  } catch (error) {
    if (error instanceof StudioTextValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json(
      { error: 'Invalid text generation request.' },
      { status: 400 },
    );
  }

  const { prompt, requestId } = body;
  const effort = body.reasoningEffort;
  const maxOutputTokens =
    effort === 'low' ? 1_024 : effort === 'medium' ? 2_048 : 4_096;
  const requestedModelId = body.modelId;
  if (requestedModelId !== undefined && !isStudioAgentModelId(requestedModelId)) {
    return Response.json(
      { error: 'Unsupported text model.' },
      { status: 400 },
    );
  }

  let quote: ReturnType<typeof priceStudioUsage> | undefined;
  try {
    const runtime = await getStudioRuntimeConfig();
    const modelId = requestedModelId ?? runtime.agentModelId;
    if (!isStudioModelEnabled(modelId, runtime)) {
      return Response.json(
        { error: 'This text model is currently disabled.' },
        { status: 403 },
      );
    }
    const current = body.current;
    const generationPrompt = current
      ? `Rewrite or expand the following copy. Return only the finished copy.\nRequirements: ${prompt}\nOriginal: ${current}`
      : `Write copy for a creative canvas. Return only the finished copy.\nRequirements: ${prompt}`;
    quote = priceStudioUsage({
      modelId,
      upstreamUsdMicros: estimateStudioLanguageUpstreamUsdMicros({
        modelId,
        // UTF-8 bytes are a conservative token reserve for multilingual copy.
        inputTokens: Math.max(
          1_024,
          new TextEncoder().encode(generationPrompt).length + 512,
        ),
        outputTokens: maxOutputTokens,
      }),
      runtime,
    });
    const expectedCreditsStatus = expectedStudioCreditsStatus(
      body.expectedCredits,
      quote,
    );
    if (
      expectedCreditsStatus === 'invalid' ||
      expectedCreditsStatus === 'not-provided'
    ) {
      return Response.json(
        {
          error:
            'Missing or invalid expected credit quote. Refresh and try again.',
        },
        { status: 400 },
      );
    }
    if (expectedCreditsStatus === 'changed') {
      return Response.json(
        {
          error: `Price changed to ${quote.credits} credits. Refresh and try again.`,
          code: 'PRICE_CHANGED',
          ...quote,
        },
        { status: 409 },
      );
    }
    const metered = await beginMeteredRequest({
      userId: user.id,
      requestId,
      kind: 'text',
      cost: quote.credits,
      projectId: body.projectId,
      nodeId: body.nodeId,
    });
    if (!metered.accepted) {
      if (metered.status === 'completed' && metered.result) {
        return Response.json(metered.result);
      }
      if (metered.status === 'pending') {
        return Response.json(
          {
            status: 'processing',
            retryAfterMs: 2_000,
            balance: metered.balance,
          },
          { status: 202, headers: { 'Retry-After': '2' } },
        );
      }
      return Response.json(
        {
          error: 'This generation failed. Generate it again.',
          balance: metered.balance,
        },
        { status: 409 },
      );
    }

    const result = await generateText({
      model: modelId,
      prompt: generationPrompt,
      maxOutputTokens,
      providerOptions: {
        gateway: {
          only: [STUDIO_AGENT_GATEWAY_PROVIDER_BY_MODEL[modelId]],
          user: user.id,
          tags: ['feature:studio-text'],
        },
        ...(modelId.startsWith('openai/')
          ? { openai: { reasoningEffort: effort } }
          : {}),
      },
    });
    const response = {
      text: result.text,
      balance: metered.balance,
      credits: quote.credits,
      upstreamUsdMicros: quote.upstreamUsdMicros,
      markupBps: quote.markupBps,
      pricingVersion: quote.pricingVersion,
    };
    await completeMeteredRequest({
      userId: user.id,
      requestId,
      result: response,
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return Response.json(
        {
          error: 'Not enough credits. Top up first.',
          code: 'INSUFFICIENT_CREDITS',
          ...(quote ?? {}),
        },
        { status: 402 },
      );
    }
    const message = error instanceof Error ? error.message : 'Text generation failed.';
    await failMeteredRequest({
      userId: user.id,
      requestId,
      error: message,
    }).catch(() => undefined);
    return Response.json(
      { error: friendlyAiError(message) },
      { status: 502 },
    );
  }
}
