import { generateText } from 'ai';
import { friendlyAiError } from '@/lib/studio/errors';
import { STUDIO_TEXT_MODEL } from '@/lib/studio/models';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { prompt, current = '', reasoningEffort = 'high' } = (await req.json()) as {
    prompt?: string;
    current?: string;
    reasoningEffort?: 'low' | 'medium' | 'high';
  };
  if (!prompt?.trim()) {
    return Response.json({ error: '请先填写提示词。' }, { status: 400 });
  }

  const effort = reasoningEffort === 'low' || reasoningEffort === 'medium' ? reasoningEffort : 'high';

  try {
    const result = await generateText({
      model: STUDIO_TEXT_MODEL,
      prompt: current.trim()
        ? `根据要求改写或扩写以下文案。只输出文案本身。\n要求：${prompt}\n原文：${current}`
        : `根据要求写一段可用于画布的中文文案。只输出文案本身。\n要求：${prompt}`,
      providerOptions: {
        xai: { reasoningEffort: effort },
      },
    });
    return Response.json({ text: result.text });
  } catch (error) {
    const message = error instanceof Error ? error.message : '文本生成失败';
    return Response.json({ error: friendlyAiError(message) }, { status: 502 });
  }
}
