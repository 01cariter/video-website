import { consumeStream, createAgentUIStreamResponse, type UIMessage } from 'ai';
import { getStudioRuntimeConfig } from '@/flags';
import {
  beginMeteredRequest,
  completeMeteredRequest,
  failMeteredRequest,
  InsufficientCreditsError,
} from '@/lib/credits/server';
import {
  createStudioAgent,
  type CanvasNodeSnapshot,
} from '@/lib/studio/agent';
import { friendlyAiError } from '@/lib/studio/errors';
import {
  estimateStudioAgentInputTokenReserve,
  estimateStudioLanguageUpstreamUsdMicros,
  isStudioModelEnabled,
  priceStudioUsage,
  STUDIO_AGENT_MAX_OUTPUT_TOKENS_PER_STEP,
  STUDIO_AGENT_MAX_STEPS,
} from '@/lib/studio/pricing';
import {
  MAX_ACTIVE_STUDIO_SKILLS,
  isStudioSkillId,
  normalizeStudioSkillIds,
} from '@/lib/studio/skills/catalog';
import { withoutSkillResourceHistory } from '@/lib/studio/skills/messages';
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
    skillIds?: unknown;
  } | null;
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const canvas = Array.isArray(body?.canvas) ? body.canvas.slice(0, 200) : [];
  const requestId = body?.requestId?.trim();
  if (!requestId || requestId.length > 160) {
    return Response.json({ error: 'Invalid request identifier.' }, { status: 400 });
  }
  if (
    body?.skillIds !== undefined &&
    (!Array.isArray(body.skillIds) ||
      body.skillIds.length > MAX_ACTIVE_STUDIO_SKILLS ||
      body.skillIds.some((id) => !isStudioSkillId(id)))
  ) {
    return Response.json(
      { error: 'Invalid skill selection.' },
      { status: 400 },
    );
  }
  const skillIds = normalizeStudioSkillIds(body?.skillIds);
  const requestInputBytes = new TextEncoder().encode(
    JSON.stringify({ messages, canvas, skillIds }),
  ).length;
  if (requestInputBytes > 64_000) {
    return Response.json(
      { error: 'Agent input is too large.' },
      { status: 413 },
    );
  }

  try {
    const runtime = await getStudioRuntimeConfig();
    if (!isStudioModelEnabled(runtime.agentModelId, runtime)) {
      return Response.json(
        { error: 'The configured Agent model is currently disabled.' },
        { status: 503 },
      );
    }
    const reservedQuote = priceStudioUsage({
      modelId: runtime.agentModelId,
      upstreamUsdMicros: estimateStudioLanguageUpstreamUsdMicros({
        modelId: runtime.agentModelId,
        inputTokens: estimateStudioAgentInputTokenReserve({
          requestBytes: requestInputBytes,
          hasSkills: skillIds.length > 0,
        }),
        outputTokens:
          STUDIO_AGENT_MAX_STEPS *
          STUDIO_AGENT_MAX_OUTPUT_TOKENS_PER_STEP,
      }),
      runtime,
    });
    const metered = await beginMeteredRequest({
      userId: user.id,
      requestId,
      kind: 'agent',
      cost: reservedQuote.credits,
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
    type StepUsage = {
      inputTokens: number | undefined;
      outputTokens: number | undefined;
    };
    const completedStepUsage: StepUsage[] = [];
    let agentUsage:
      | {
          inputTokens: number | undefined;
          outputTokens: number | undefined;
          steps: StepUsage[];
        }
      | undefined;
    let settlement: Promise<unknown> | undefined;

    const settleAgentRequest = (
      completed: boolean,
      error?: string,
    ): Promise<unknown> => {
      if (settlement) return settlement;
      const steps = agentUsage?.steps.length
        ? agentUsage.steps
        : completedStepUsage;
      if (!steps.length) {
        settlement = failMeteredRequest({
          userId: user.id,
          requestId,
          error: error || 'Agent request failed before model usage.',
        });
        return settlement;
      }

      const completeUsage = steps.every(
        (step) =>
          typeof step.inputTokens === 'number' &&
          typeof step.outputTokens === 'number',
      );
      const actualQuote = completeUsage
        ? priceStudioUsage({
            modelId: runtime.agentModelId,
            upstreamUsdMicros: steps.reduce(
              (total, step) =>
                total +
                estimateStudioLanguageUpstreamUsdMicros({
                  modelId: runtime.agentModelId,
                  inputTokens: step.inputTokens ?? 0,
                  outputTokens: step.outputTokens ?? 0,
                }),
              0,
            ),
            runtime,
          })
        : reservedQuote;
      const settledQuote =
        actualQuote.credits <= reservedQuote.credits
          ? actualQuote
          : reservedQuote;
      settlement = completeMeteredRequest({
        userId: user.id,
        requestId,
        actualCost: settledQuote.credits,
        result: {
          completed,
          error,
          pricing: settledQuote,
          reservedCredits: reservedQuote.credits,
          usage: {
            inputTokens: agentUsage?.inputTokens,
            outputTokens: agentUsage?.outputTokens,
            steps,
          },
        },
      });
      return settlement;
    };

    const agent = createStudioAgent(
      canvas,
      runtime,
      ({ usage, steps }) => {
        agentUsage = { ...usage, steps };
      },
      skillIds,
    );

    return createAgentUIStreamResponse({
      agent,
      uiMessages: withoutSkillResourceHistory(messages),
      consumeSseStream: ({ stream }) => consumeStream({ stream }),
      onStepEnd: (step) => {
        completedStepUsage.push({
          inputTokens: step.usage.inputTokens,
          outputTokens: step.usage.outputTokens,
        });
      },
      onError: (error) => {
        streamFailed = true;
        const message =
          error instanceof Error ? error.message : 'Agent request failed.';
        void settleAgentRequest(false, message).catch(() => undefined);
        return friendlyAiError(message);
      },
      onEnd: async ({ isAborted, finishReason }) => {
        if (streamFailed || isAborted || finishReason === 'error') {
          await settleAgentRequest(
            false,
            isAborted ? 'Agent request aborted' : 'Agent stream failed',
          );
          return;
        }
        await settleAgentRequest(true);
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
