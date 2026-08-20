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
  normalizeStudioVideoRequest,
  STUDIO_VIDEO_MODEL_IDS,
  VideoGenerationValidationError,
  videoParametersFromBody,
  videoReferenceFromBody,
} from '@/lib/studio/video-generation';
import { getAuthUser } from '@/lib/supabase/server';

export const maxDuration = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : undefined;
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
  const prompt = stringField(body, 'prompt');
  const requestId = stringField(body, 'requestId');
  if (!prompt) {
    return Response.json({ error: 'Add a prompt first.' }, { status: 400 });
  }
  if (!requestId || requestId.length > 160) {
    return Response.json(
      { error: 'Invalid request identifier.' },
      { status: 400 },
    );
  }

  const projectId = stringField(body, 'projectId');
  const nodeId = stringField(body, 'nodeId');
  const runtime = await getStudioRuntimeConfig();
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
  let videoRequest;
  try {
    videoRequest = normalizeStudioVideoRequest({
      modelId: body.modelId === undefined ? modelId : body.modelId,
      parameters: videoParametersFromBody(body),
      referenceImage: videoReferenceFromBody(body),
    });
  } catch (error) {
    if (error instanceof VideoGenerationValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
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
      return Response.json(
        {
          error: 'This generation is processing or failed. Generate it again.',
          balance: metered.balance,
        },
        { status: 409 },
      );
    }
    meteredAccepted = true;

    const { video } = await generateVideo(
      buildStudioVideoGeneratePayload({ prompt, request: videoRequest }),
    );
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

    const message =
      error instanceof Error ? error.message : 'Video generation failed.';
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
