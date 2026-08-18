import { experimental_generateVideo as generateVideo } from 'ai';
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
      { error: '请先登录，再生成视频。' },
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
    requestId?: string;
    projectId?: string;
    nodeId?: string;
  } | null;
  const prompt = body?.prompt?.trim();
  const requestId = body?.requestId?.trim();
  if (!prompt) {
    return Response.json({ error: '请先填写提示词。' }, { status: 400 });
  }
  if (!requestId || requestId.length > 160) {
    return Response.json({ error: '请求标识无效。' }, { status: 400 });
  }

  const aspect = body?.aspect || '16:9';
  const aspectRatio = VIDEO_ASPECTS.has(aspect)
    ? (aspect as `${number}:${number}`)
    : '16:9';
  const seconds = Math.min(30, Math.max(4, Number(body?.duration) || 5));
  const resolution = body?.videoResolution === '480p' ? '480p' : '720p';
  const generateAudio = Boolean(body?.generateAudio);
  const model = resolveStudioModel('video', body?.modelId);

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
          error: '这条生成请求正在处理或已经失败，请重新生成。',
          balance: metered.balance,
        },
        { status: 409 },
      );
    }

    const { video } = await generateVideo({
      model: model.id,
      prompt: body?.refSrc
        ? { image: body.refSrc, text: prompt }
        : prompt,
      aspectRatio: body?.refSrc ? 'adaptive' : aspectRatio,
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
        { error: '积分不足，请先充值。', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 },
      );
    }
    const message = error instanceof Error ? error.message : '视频生成失败';
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
