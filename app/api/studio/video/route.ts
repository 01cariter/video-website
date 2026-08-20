import { experimental_generateVideo as generateVideo } from 'ai';
import { freeCreditModelsOnly } from '@/flags';
import { videoCreditCost } from '@/lib/credits/config';
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
  videoPixelSize,
} from '@/lib/studio/model-catalog';
import { getAuthUser } from '@/lib/supabase/server';

export const maxDuration = 300;

const VIDEO_ASPECTS = new Set([
  '16:9',
  '4:3',
  '1:1',
  '3:4',
  '9:16',
  '21:9',
]);

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: 'Sign in to generate video.' },
      { status: 401 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
    modelId?: string;
    aspect?: string;
    duration?: number;
    videoResolution?: '480p' | '720p';
    generateAudio?: boolean;
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

  const aspect = body?.aspect || '16:9';
  const aspectRatio = VIDEO_ASPECTS.has(aspect)
    ? (aspect as `${number}:${number}`)
    : '16:9';
  const seconds = Math.min(30, Math.max(4, Number(body?.duration) || 5));
  const resolution = body?.videoResolution === '480p' ? '480p' : '720p';
  const generateAudio = Boolean(body?.generateAudio);
  const restrictToFreeCreditModels = await freeCreditModelsOnly();
  if (!hasAvailableStudioModel('video', restrictToFreeCreditModels)) {
    return Response.json(
      { error: 'Video generation requires paid AI Gateway credits.' },
      { status: 403 },
    );
  }
  const model = resolveStudioModel(
    'video',
    body?.modelId,
    restrictToFreeCreditModels,
  );
  const referenceImage = (
    Array.isArray(body?.refSrcs) ? body.refSrcs[0] : body?.refSrc
  )?.trim();

  try {
    const metered = await beginMeteredRequest({
      userId: user.id,
      requestId,
      kind: 'video',
      cost: videoCreditCost({
        duration: seconds,
        resolution,
        generateAudio,
      }),
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

    const { video } = await generateVideo({
      model: model.id,
      prompt: referenceImage
        ? { image: referenceImage, text: prompt }
        : prompt,
      aspectRatio: referenceImage ? 'adaptive' : aspectRatio,
      duration: seconds,
      resolution: videoPixelSize(aspectRatio, resolution),
      providerOptions: {
        bytedance: { generateAudio },
      },
    });
    const url = await storeGeneratedAsset({
      userId: user.id,
      projectId: body?.projectId,
      requestId,
      kind: 'video',
      mediaType: video.mediaType || 'video/mp4',
      base64: video.base64,
    });
    const response = { url, balance: metered.balance };
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
    const message = error instanceof Error ? error.message : 'Video generation failed.';
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
