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
  imageParametersFromBody,
  prepareStudioImageRequest,
  STUDIO_IMAGE_MODEL_IDS,
  StudioImageValidationError,
  type StudioImageRequestBodyLike,
} from '@/lib/studio/image-generation';
import { generatePreparedStudioImages } from '@/lib/studio/image-provider';
import {
  estimateStudioCredits,
  expectedStudioCreditsStatus,
  isStudioModelEnabled,
} from '@/lib/studio/pricing';
import { getAuthUser } from '@/lib/supabase/server';

export const maxDuration = 120;

interface StudioImageRequestBody extends StudioImageRequestBodyLike {
  prompt?: unknown;
  modelId?: unknown;
  refSrc?: unknown;
  refSrcs?: unknown;
  requestId?: unknown;
  projectId?: unknown;
  nodeId?: unknown;
  expectedCredits?: unknown;
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: 'Sign in to generate images.' },
      { status: 401 },
    );
  }

  const parsedBody: unknown = await request.json().catch(() => null);
  if (!isRecord(parsedBody)) {
    return Response.json({ error: 'Invalid image request.' }, { status: 400 });
  }
  const body = parsedBody as StudioImageRequestBody;
  const requestId = optionalTrimmedString(body.requestId);
  if (!requestId || requestId.length > 160) {
    return Response.json(
      { error: 'Invalid request identifier.' },
      { status: 400 },
    );
  }
  const projectId = optionalTrimmedString(body.projectId);
  const nodeId = optionalTrimmedString(body.nodeId);
  if ((projectId?.length ?? 0) > 160 || (nodeId?.length ?? 0) > 160) {
    return Response.json(
      { error: 'Invalid project or node identifier.' },
      { status: 400 },
    );
  }

  let prepared: ReturnType<typeof prepareStudioImageRequest>;
  let pricing: ReturnType<typeof estimateStudioCredits>;
  try {
    const runtime = await getStudioRuntimeConfig();
    const modelId =
      body.modelId ??
      STUDIO_IMAGE_MODEL_IDS.find((candidate) =>
        isStudioModelEnabled(candidate, runtime),
      );
    if (!modelId) {
      return Response.json(
        { error: 'Image generation is currently disabled.' },
        { status: 403 },
      );
    }
    prepared = prepareStudioImageRequest({
      modelId,
      prompt: body.prompt,
      parameters: imageParametersFromBody(body),
      referenceImages:
        body.refSrcs !== undefined
          ? body.refSrcs
          : body.refSrc !== undefined
            ? [body.refSrc]
            : [],
    });
    if (!isStudioModelEnabled(prepared.modelId, runtime)) {
      return Response.json(
        { error: 'This image model is currently disabled.' },
        { status: 403 },
      );
    }
    pricing = estimateStudioCredits({
      kind: 'image',
      modelId: prepared.modelId,
      parameters: prepared.parameters,
      prompt: prepared.prompt,
      referenceImages: prepared.referenceImages,
      runtime,
    });
  } catch (error) {
    if (error instanceof StudioImageValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : 'Could not price this image.';
    return Response.json({ error: friendlyAiError(message) }, { status: 500 });
  }

  const expectedCreditsStatus = expectedStudioCreditsStatus(
    body.expectedCredits,
    pricing,
  );
  if (
    expectedCreditsStatus === 'invalid' ||
    expectedCreditsStatus === 'not-provided'
  ) {
    return Response.json(
      { error: 'Missing or invalid expected credit quote. Refresh and try again.' },
      { status: 400 },
    );
  }
  if (expectedCreditsStatus === 'changed') {
    return Response.json(
      {
        error: `Price changed to ${pricing.credits} credits. Refresh and try again.`,
        code: 'PRICE_CHANGED',
        ...pricing,
      },
      { status: 409 },
    );
  }

  let metered: Awaited<ReturnType<typeof beginMeteredRequest>>;
  try {
    metered = await beginMeteredRequest({
      userId: user.id,
      requestId,
      kind: 'image',
      cost: pricing.credits,
      projectId,
      nodeId,
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return Response.json(
        {
          error: 'Not enough credits. Top up first.',
          code: 'INSUFFICIENT_CREDITS',
          credits: pricing.credits,
          upstreamUsdMicros: pricing.upstreamUsdMicros,
          markupBps: pricing.markupBps,
          pricingVersion: pricing.pricingVersion,
        },
        { status: 402 },
      );
    }
    const message =
      error instanceof Error ? error.message : 'Could not start generation.';
    return Response.json({ error: friendlyAiError(message) }, { status: 500 });
  }

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

  try {
    const images = await generatePreparedStudioImages(prepared);
    if (images.length !== prepared.count) {
      throw new Error(
        `The provider returned ${images.length} of ${prepared.count} requested images.`,
      );
    }
    const urls = await Promise.all(
      images.map((image, index) =>
        storeGeneratedAsset({
          userId: user.id,
          projectId,
          requestId,
          index,
          kind: 'image',
          mediaType: image.mediaType || 'image/png',
          base64: image.base64,
        }),
      ),
    );
    const response = {
      url: urls[0],
      urls,
      balance: metered.balance,
      credits: pricing.credits,
      upstreamUsdMicros: pricing.upstreamUsdMicros,
      markupBps: pricing.markupBps,
      pricingVersion: pricing.pricingVersion,
      modelId: prepared.modelId,
      parameters: prepared.parameters,
    };
    await completeMeteredRequest({
      userId: user.id,
      requestId,
      result: response,
    });
    return Response.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Image generation failed.';
    const balance = await failMeteredRequest({
      userId: user.id,
      requestId,
      error: message,
    }).catch(() => undefined);
    return Response.json(
      { error: friendlyAiError(message), balance },
      { status: 502 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined;
}
