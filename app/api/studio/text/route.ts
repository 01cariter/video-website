import { generateText } from 'ai';
import { freeCreditModelsOnly } from '@/flags';
import { CREDIT_COSTS } from '@/lib/credits/config';
import {
  beginMeteredRequest,
  completeMeteredRequest,
  failMeteredRequest,
  InsufficientCreditsError,
} from '@/lib/credits/server';
import { friendlyAiError } from '@/lib/studio/errors';
import {
  hasAvailableStudioModel,
  resolveStudioModel,
} from '@/lib/studio/model-catalog';
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
  } | null;
  const prompt = body?.prompt?.trim();
  const requestId = body?.requestId?.trim();
  if (!prompt) {
    return Response.json({ error: 'Add a prompt first.' }, { status: 400 });
  }
  if (!requestId || requestId.length > 160) {
    return Response.json({ error: 'Invalid request identifier.' }, { status: 400 });
  }
  const effort =
    body?.reasoningEffort === 'low' || body?.reasoningEffort === 'medium'
      ? body.reasoningEffort
      : 'high';
  const restrictToFreeCreditModels = await freeCreditModelsOnly();
  if (!hasAvailableStudioModel('text', restrictToFreeCreditModels)) {
    return Response.json(
      { error: 'Text generation requires paid AI Gateway credits.' },
      { status: 403 },
    );
  }
  const model = resolveStudioModel(
    'text',
    body?.modelId,
    restrictToFreeCreditModels,
  );

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
          error: 'This generation is processing or failed. Generate it again.',
          balance: metered.balance,
        },
        { status: 409 },
      );
    }

    const current = body?.current?.trim() || '';
    const result = await generateText({
      model: model.id,
      prompt: current
        ? `Rewrite or expand the following copy. Return only the finished copy.\nRequirements: ${prompt}\nOriginal: ${current}`
        : `Write copy for a creative canvas. Return only the finished copy.\nRequirements: ${prompt}`,
      providerOptions: model.id.startsWith('openai/')
        ? {
            openai: { reasoningEffort: effort },
          }
        : undefined,
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
        { error: 'Not enough credits. Top up first.', code: 'INSUFFICIENT_CREDITS' },
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
