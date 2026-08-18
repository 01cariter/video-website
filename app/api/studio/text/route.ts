import { generateText } from 'ai';
import { CREDIT_COSTS } from '@/lib/credits/config';
import {
  beginMeteredRequest,
  completeMeteredRequest,
  failMeteredRequest,
  InsufficientCreditsError,
} from '@/lib/credits/server';
import { friendlyAiError } from '@/lib/studio/errors';
import { resolveStudioModel } from '@/lib/studio/model-catalog';
import { getAuthUser } from '@/lib/supabase/server';

export const maxDuration = 45;

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: '请先登录，再生成文本。' },
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
  } | null;
  const prompt = body?.prompt?.trim();
  const requestId = body?.requestId?.trim();
  if (!prompt) {
    return Response.json({ error: '请先填写提示词。' }, { status: 400 });
  }
  if (!requestId || requestId.length > 160) {
    return Response.json({ error: '请求标识无效。' }, { status: 400 });
  }
  const effort =
    body?.reasoningEffort === 'low' || body?.reasoningEffort === 'medium'
      ? body.reasoningEffort
      : 'high';
  const model = resolveStudioModel('text', body?.modelId);

  try {
    const metered = await beginMeteredRequest({
      userId: user.id,
      requestId,
      kind: 'text',
      cost: CREDIT_COSTS.text,
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

    const current = body?.current?.trim() || '';
    const result = await generateText({
      model: model.id,
      prompt: current
        ? `根据要求改写或扩写以下文案。只输出文案本身。\n要求：${prompt}\n原文：${current}`
        : `根据要求写一段可用于画布的中文文案。只输出文案本身。\n要求：${prompt}`,
      providerOptions: {
        openai: { reasoningEffort: effort },
      },
    });
    const response = { text: result.text, balance: metered.balance };
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
    const message = error instanceof Error ? error.message : '文本生成失败';
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
