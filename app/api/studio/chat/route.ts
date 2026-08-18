import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import { freeCreditModelsOnly } from '@/flags';
import {
  beginMeteredRequest,
  completeMeteredRequest,
  failMeteredRequest,
  InsufficientCreditsError,
} from '@/lib/credits/server';
import { CREDIT_COSTS } from '@/lib/credits/config';
import {
  createStudioAgent,
  type CanvasNodeSnapshot,
} from '@/lib/studio/agent';
import { friendlyAiError } from '@/lib/studio/errors';
import { getAuthUser } from '@/lib/supabase/server';

export const maxDuration = 90;

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: 'Sign in to use the AI Agent.' },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: UIMessage[];
    canvas?: CanvasNodeSnapshot[];
    requestId?: string;
    projectId?: string;
  } | null;
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const canvas = Array.isArray(body?.canvas) ? body.canvas.slice(0, 200) : [];
  const requestId = body?.requestId?.trim();
  if (!requestId || requestId.length > 160) {
    return Response.json({ error: 'Invalid request identifier.' }, { status: 400 });
  }

  try {
    const restrictToFreeCreditModels = await freeCreditModelsOnly();
    const metered = await beginMeteredRequest({
      userId: user.id,
      requestId,
      kind: 'agent',
      cost: CREDIT_COSTS.agent,
      projectId: body?.projectId,
    });
    if (!metered.accepted) {
      return Response.json(
        {
          error:
            metered.status === 'completed'
              ? 'This Agent request has already completed.'
              : 'This Agent request is processing or failed. Send it again.',
          balance: metered.balance,
        },
        { status: 409 },
      );
    }

    let streamFailed = false;
    const agent = createStudioAgent(canvas, restrictToFreeCreditModels);

    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      abortSignal: request.signal,
      onError: (error) => {
        streamFailed = true;
        const message =
          error instanceof Error ? error.message : 'Agent request failed.';
        void failMeteredRequest({
          userId: user.id,
          requestId,
          error: message,
        }).catch(() => undefined);
        return friendlyAiError(message);
      },
      onEnd: async ({ isAborted, finishReason }) => {
        if (streamFailed || isAborted || finishReason === 'error') {
          await failMeteredRequest({
            userId: user.id,
            requestId,
            error: isAborted ? 'Agent request aborted' : 'Agent stream failed',
          });
          return;
        }
        await completeMeteredRequest({
          userId: user.id,
          requestId,
          result: { completed: true },
        });
      },
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return Response.json(
        { error: 'Not enough credits. Top up first.', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 },
      );
    }
    await failMeteredRequest({
      userId: user.id,
      requestId,
      error: error instanceof Error ? error.message : 'Agent request failed.',
    }).catch(() => undefined);
    return Response.json(
      {
        error: friendlyAiError(
          error instanceof Error ? error.message : 'Agent request failed.',
        ),
      },
      { status: 502 },
    );
  }
}
