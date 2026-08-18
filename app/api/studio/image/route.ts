import { generateImage } from 'ai';
import { imageCreditCost } from '@/lib/credits/config';
import {
  beginMeteredRequest,
  completeMeteredRequest,
  failMeteredRequest,
  InsufficientCreditsError,
} from '@/lib/credits/server';
import { friendlyAiError } from '@/lib/studio/errors';
import { storeGeneratedAsset } from '@/lib/studio/generated-assets';
import { resolveStudioModel } from '@/lib/studio/model-catalog';
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
      { error: '请先登录，再生成图片。' },
      { status: 401 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
    modelId?: string;
    aspect?: string;
    n?: number;
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

  const count = Math.min(4, Math.max(1, Number(body?.n) || 1));
  const aspect = body?.aspect || '1:1';
  const aspectRatio = IMAGE_ASPECTS.has(aspect)
    ? (aspect as `${number}:${number}` | 'auto')
    : '1:1';
  const model = resolveStudioModel('image', body?.modelId);

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
          error: '这条生成请求正在处理或已经失败，请重新生成。',
          balance: metered.balance,
        },
        { status: 409 },
      );
    }

    const result = await generateImage({
      model: model.id,
      prompt: body?.refSrc
        ? { text: prompt, images: [body.refSrc] }
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
        { error: '积分不足，请先充值。', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 },
      );
    }
    const message = error instanceof Error ? error.message : '图片生成失败';
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
