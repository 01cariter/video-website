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
  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
    modelId?: string;
    current?: string;
    reasoningEffort?: 'low' | 'medium' | 'high';
    requestId?: string;
    projectId?: string;
    nodeId?: string;
    expectedCredits?: unknown;
  } | null;
  const prompt = body?.prompt?.trim();
  const requestId = body?.requestId?.trim();
  if (!prompt) {
    return Response.json({ error: 'Add a prompt first.' }, { status: 400 });
  }
  if (prompt.length > 20_000 || (body?.current?.length ?? 0) > 20_000) {
    return Response.json(
      { error: 'Text generation input is too long.' },
      { status: 400 },
    );
  }
  if (!requestId || requestId.length > 160) {
    return Response.json({ error: 'Invalid request identifier.' }, { status: 400 });
  }
  const effort =
    body?.reasoningEffort === 'low' || body?.reasoningEffort === 'medium'
      ? body.reasoningEffort
      : 'high';
  const maxOutputTokens =
    effort === 'low' ? 1_024 : effort === 'medium' ? 2_048 : 4_096;
  const requestedModelId = body?.modelId;
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
    const current = body?.current?.trim() || '';
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
      body?.expectedCredits,
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
      projectId: body?.projectId,
      nodeId: body?.nodeId,
    });
    if (!metered.accepted) {
      if (metered.status === 'completed' && metered.result) {
        return Response.json(metered.result);
      }
      return Response.json(
        {
          error: 'This generation is processing or failed. Generate it again.',
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
