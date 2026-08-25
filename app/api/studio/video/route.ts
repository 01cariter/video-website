import { experimental_generateVideo as generateVideo } from 'ai';
import { getStudioRuntimeConfig } from '@/flags';
import {
  beginMeteredRequest,
  completeMeteredRequest,
  failMeteredRequest,
  InsufficientCreditsError,
} from '@/lib/credits/server';
import { friendlyAiError } from '@/lib/studio/errors';
import { storeGeneratedAsset } from '@/lib/studio/generated-assets';
import {
  expectedStudioCreditsStatus,
  isStudioModelEnabled,
  priceStudioUsage,
} from '@/lib/studio/pricing';
import {
  buildStudioVideoGeneratePayload,
  estimateStudioVideoUpstreamUsdMicros,
  normalizeStudioVideoPrompt,
  normalizeStudioVideoRequest,
  STUDIO_VIDEO_MODEL_IDS,
  VideoGenerationValidationError,
  videoParametersFromBody,
  videoReferenceFromBody,
} from '@/lib/studio/video-generation';
import { getAuthUser } from '@/lib/supabase/server';

// Video providers are asynchronous and may legitimately poll for 10 minutes.
// Keep enough room for polling plus asset persistence, while aborting before
// Vercel's Pro function ceiling so metering can be refunded in our catch path.
export const maxDuration = 800;
const VIDEO_GENERATION_TIMEOUT_MS = 720_000;
const MINIMAX_POLL_TIMEOUT_MS = 600_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : undefined;
}

function videoErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'Video generation failed.';
  return /timed? ?out|timeout|aborted due to timeout/i.test(message)
    ? 'Video generation did not finish within 12 minutes. Your reserved credits were refunded.'
    : message;
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: 'Sign in to generate video.' },
      { status: 401 },
    );
  }

  const parsedBody: unknown = await request.json().catch(() => null);
  const body = isRecord(parsedBody) ? parsedBody : {};
  const requestId = stringField(body, 'requestId');
  if (!requestId || requestId.length > 160) {
    return Response.json(
      { error: 'Invalid request identifier.' },
      { status: 400 },
    );
  }

  const projectId = stringField(body, 'projectId');
  const nodeId = stringField(body, 'nodeId');
  if ((projectId?.length ?? 0) > 160 || (nodeId?.length ?? 0) > 160) {
    return Response.json(
      { error: 'Invalid project or node identifier.' },
      { status: 400 },
    );
  }
  let prompt: string;
  let runtime: Awaited<ReturnType<typeof getStudioRuntimeConfig>>;
  let videoRequest: ReturnType<typeof normalizeStudioVideoRequest>;
  try {
    prompt = normalizeStudioVideoPrompt(body.prompt);
    runtime = await getStudioRuntimeConfig();
    const modelId =
      body.modelId ??
      STUDIO_VIDEO_MODEL_IDS.find((candidate) =>
        isStudioModelEnabled(candidate, runtime),
      );
    if (!modelId) {
      return Response.json(
        { error: 'Video generation is currently disabled.' },
        { status: 403 },
      );
    }
    videoRequest = normalizeStudioVideoRequest({
      modelId: body.modelId === undefined ? modelId : body.modelId,
      parameters: videoParametersFromBody(body),
      referenceImage: videoReferenceFromBody(body),
    });
  } catch (error) {
    if (error instanceof VideoGenerationValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error
        ? error.message
        : 'Could not prepare video generation.';
    return Response.json({ error: friendlyAiError(message) }, { status: 500 });
  }

  let meteredAccepted = false;
  let quote: ReturnType<typeof priceStudioUsage> | undefined;
  try {
    if (!isStudioModelEnabled(videoRequest.modelId, runtime)) {
      return Response.json(
        { error: 'This video model is currently unavailable.' },
        { status: 403 },
      );
    }

    const upstreamUsdMicros =
      estimateStudioVideoUpstreamUsdMicros(videoRequest);
    quote = priceStudioUsage({
      modelId: videoRequest.modelId,
      upstreamUsdMicros,
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
      kind: 'video',
      cost: quote.credits,
      projectId,
      nodeId,
    });
    if (!metered.accepted) {
      if (metered.status === 'completed' && metered.result) {
        return Response.json(metered.result);
      }
      if (metered.status === 'pending') {
        return Response.json(
          {
            status: 'processing',
            retryAfterMs: 5_000,
            balance: metered.balance,
          },
          { status: 202, headers: { 'Retry-After': '5' } },
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
    meteredAccepted = true;

    const payload = buildStudioVideoGeneratePayload({
      prompt,
      request: videoRequest,
    });
    const { video } = await generateVideo({
      ...payload,
      abortSignal: AbortSignal.timeout(VIDEO_GENERATION_TIMEOUT_MS),
      providerOptions: {
        gateway: {
          user: user.id,
          tags: ['feature:studio-video'],
        },
        ...(videoRequest.modelId === 'minimax/minimax-h3'
          ? {
              minimax: {
                pollTimeoutMs: MINIMAX_POLL_TIMEOUT_MS,
                resolution: '2K',
              },
            }
          : {}),
      },
    });
    const url = await storeGeneratedAsset({
      userId: user.id,
      projectId,
      requestId,
      kind: 'video',
      mediaType: video.mediaType || 'video/mp4',
      base64: video.base64,
    });
    const response = {
      url,
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

    const message = videoErrorMessage(error);
    const balance = meteredAccepted
      ? await failMeteredRequest({
          userId: user.id,
          requestId,
          error: message,
        }).catch(() => undefined)
      : undefined;
    return Response.json(
      { error: friendlyAiError(message), balance },
      { status: 502 },
    );
  }
}
