import { generateImage } from 'ai';
import { freeCreditModelsOnly } from '@/flags';
import { imageCreditCost } from '@/lib/credits/config';
import {
  beginMeteredRequest,
  completeMeteredRequest,
  failMeteredRequest,
  InsufficientCreditsError,
} from '@/lib/credits/server';
import { friendlyAiError } from '@/lib/studio/errors';
import { storeGeneratedAsset } from '@/lib/studio/generated-assets';
import {
  hasAvailableStudioModel,
  resolveStudioModel,
} from '@/lib/studio/model-catalog';
import { getAuthUser } from '@/lib/supabase/server';

export const maxDuration = 120;

const IMAGE_ASPECTS = new Set([
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '2:1',
  '1:2',
  '19.5:9',
  '9:19.5',
  '20:9',
  '9:20',
  'auto',
]);

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: 'Sign in to generate images.' },
      { status: 401 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
    modelId?: string;
    aspect?: string;
    n?: number;
    refSrc?: string;
    refSrcs?: string[];
    requestId?: string;
    projectId?: string;
    nodeId?: string;
  } | null;
  const prompt = body?.prompt?.trim();
  const requestId = body?.requestId?.trim();
  if (!prompt) {
    return Response.json({ error: 'Add a prompt first.' }, { status: 400 });
  }
  if (!requestId || requestId.length > 160) {
    return Response.json({ error: 'Invalid request identifier.' }, { status: 400 });
  }

  const count = Math.min(4, Math.max(1, Number(body?.n) || 1));
  const aspect = body?.aspect || '1:1';
  const aspectRatio = IMAGE_ASPECTS.has(aspect)
    ? (aspect as `${number}:${number}` | 'auto')
    : '1:1';
  const restrictToFreeCreditModels = await freeCreditModelsOnly();
  if (
    !hasAvailableStudioModel('image', restrictToFreeCreditModels)
  ) {
    return Response.json(
      { error: 'Image generation requires paid AI Gateway credits.' },
      { status: 403 },
    );
  }
  const model = resolveStudioModel(
    'image',
    body?.modelId,
    restrictToFreeCreditModels,
  );
  const referenceImages = (
    Array.isArray(body?.refSrcs)
      ? body.refSrcs
      : body?.refSrc
        ? [body.refSrc]
        : []
  )
    .filter((src): src is string => typeof src === 'string' && Boolean(src))
    .slice(0, 3);

  try {
    const metered = await beginMeteredRequest({
      userId: user.id,
      requestId,
      kind: 'image',
      cost: imageCreditCost(count),
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

    const result = await generateImage({
      model: model.id,
      prompt: referenceImages.length
        ? { text: prompt, images: referenceImages }
        : prompt,
      n: count,
      aspectRatio:
        aspectRatio === 'auto'
          ? undefined
          : (aspectRatio as `${number}:${number}`),
    });
    const urls = await Promise.all(
      result.images.map((image, index) =>
        storeGeneratedAsset({
          userId: user.id,
          projectId: body?.projectId,
          requestId,
          index,
          kind: 'image',
          mediaType: image.mediaType || 'image/png',
          base64: image.base64,
        }),
      ),
    );
    const response = { url: urls[0], urls, balance: metered.balance };
    await completeMeteredRequest({
      userId: user.id,
      requestId,
      result: response,
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return Response.json(
        { error: 'Not enough credits. Top up first.', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 },
      );
    }
    const message = error instanceof Error ? error.message : 'Image generation failed.';
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
