import {
  consumeStream,
  createAgentUIStreamResponse,
  safeValidateUIMessages,
  type UIMessage,
} from 'ai';
import { getStudioRuntimeConfig } from '@/flags';
import {
  beginMeteredRequest,
  completeMeteredRequest,
  failMeteredRequest,
  InsufficientCreditsError,
} from '@/lib/credits/server';
import { createStudioAgent } from '@/lib/studio/agent';
import {
  markSelectedCanvasNodes,
  normalizeCanvasNodeSnapshots,
  normalizeSelectedCanvasIds,
} from '@/lib/studio/agent-context';
import { stripStudioAgentEmoji } from '@/lib/studio/agent-output';
import { friendlyAiError } from '@/lib/studio/errors';
import {
  estimateStudioAgentInputTokenReserve,
  estimateStudioInterruptedAgentStepUsage,
  estimateStudioLanguageUpstreamUsdMicros,
  isStudioModelEnabled,
  priceStudioUsage,
  studioAgentModelForInput,
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
    messages?: unknown;
    canvas?: unknown;
    selectedIds?: unknown;
    requestId?: string;
    projectId?: string;
    skillIds?: unknown;
  } | null;
  const validatedMessages = await safeValidateUIMessages<UIMessage>({
    messages: body?.messages,
  });
  if (!validatedMessages.success) {
    return Response.json(
      { error: 'Invalid Agent message history.' },
      { status: 400 },
    );
  }
  const messages = validatedMessages.data;
  const normalizedCanvas = normalizeCanvasNodeSnapshots(body?.canvas);
  if (!normalizedCanvas) {
    return Response.json({ error: 'Invalid canvas context.' }, { status: 400 });
  }
  const selectedIds = normalizeSelectedCanvasIds(
    body?.selectedIds,
    normalizedCanvas,
  );
  if (!selectedIds) {
    return Response.json(
      { error: 'Invalid canvas selection.' },
      { status: 400 },
    );
  }
  const canvas = markSelectedCanvasNodes(normalizedCanvas, selectedIds);
  const requestId =
    typeof body?.requestId === 'string' ? body.requestId.trim() : '';
  const projectId =
    typeof body?.projectId === 'string' && body.projectId.length <= 160
      ? body.projectId
      : undefined;
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
    JSON.stringify({ messages, canvas, selectedIds, skillIds }),
  ).length;
  if (requestInputBytes > 64_000) {
    return Response.json(
      { error: 'Agent input is too large.' },
      { status: 413 },
    );
  }

  try {
    const runtime = await getStudioRuntimeConfig();
    const hasImageInput = messages.some(
      (message) =>
        message.role === 'user' &&
        message.parts.some(
          (part) =>
            part.type === 'file' &&
            (part.mediaType === 'image' ||
              part.mediaType.startsWith('image/')),
        ),
    );
    const agentModelId = studioAgentModelForInput(runtime, hasImageInput);
    if (!agentModelId || !isStudioModelEnabled(agentModelId, runtime)) {
      return Response.json(
        {
          error: hasImageInput
            ? 'No vision-capable Agent model is currently enabled.'
            : 'The configured Agent model is currently disabled.',
        },
        { status: 503 },
      );
    }
    const agentRuntime =
      agentModelId === runtime.agentModelId
        ? runtime
        : { ...runtime, agentModelId };
    const reservedInputTokens = estimateStudioAgentInputTokenReserve({
      requestBytes: requestInputBytes,
      hasSkills: skillIds.length > 0,
    });
    const reservedQuote = priceStudioUsage({
      modelId: agentModelId,
      upstreamUsdMicros: estimateStudioLanguageUpstreamUsdMicros({
        modelId: agentModelId,
        inputTokens: reservedInputTokens,
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
      projectId,
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
    const outputEncoder = new TextEncoder();
    let streamedOutputBytes = 0;
    let outputBytesAtLastCompletedStep = 0;
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
      includeInterruptedStep = false,
    ): Promise<unknown> => {
      if (settlement) return settlement;
      const finishedSteps = agentUsage?.steps.length
        ? agentUsage.steps
        : completedStepUsage;
      const interruptedOutputBytes = Math.max(
        0,
        streamedOutputBytes - outputBytesAtLastCompletedStep,
      );
      const steps =
        includeInterruptedStep && interruptedOutputBytes > 0
          ? [
              ...finishedSteps,
              estimateStudioInterruptedAgentStepUsage({
                reservedInputTokens,
                streamedOutputBytes: interruptedOutputBytes,
              }),
            ]
          : finishedSteps;
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
            modelId: agentModelId,
            upstreamUsdMicros: steps.reduce(
              (total, step) =>
                total +
                estimateStudioLanguageUpstreamUsdMicros({
                  modelId: agentModelId,
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
      agentRuntime,
      ({ usage, steps }) => {
        agentUsage = { ...usage, steps };
      },
      skillIds,
    );

    return createAgentUIStreamResponse({
      agent,
      uiMessages: withoutSkillResourceHistory(messages),
      abortSignal: request.signal,
      experimental_transform: () =>
        new TransformStream({
          transform(chunk, controller) {
            const rawDelta =
              chunk.type === 'text-delta' || chunk.type === 'reasoning-delta'
                ? chunk.text
                : chunk.type === 'tool-input-delta'
                  ? chunk.delta
                  : '';
            const delta = stripStudioAgentEmoji(rawDelta);
            if (delta) {
              streamedOutputBytes += outputEncoder.encode(delta).length;
            }
            const sanitizedChunk =
              rawDelta === delta
                ? chunk
                : chunk.type === 'text-delta' ||
                    chunk.type === 'reasoning-delta'
                  ? { ...chunk, text: delta }
                  : chunk.type === 'tool-input-delta'
                    ? { ...chunk, delta }
                    : chunk;
            controller.enqueue(sanitizedChunk);
          },
        }),
      consumeSseStream: ({ stream }) => consumeStream({ stream }),
      onStepEnd: (step) => {
        completedStepUsage.push({
          inputTokens: step.usage.inputTokens,
          outputTokens: step.usage.outputTokens,
        });
        outputBytesAtLastCompletedStep = streamedOutputBytes;
      },
      onError: (error) => {
        streamFailed = true;
        const message =
          error instanceof Error ? error.message : 'Agent request failed.';
        void settleAgentRequest(
          false,
          message,
          request.signal.aborted,
        ).catch(() => undefined);
        return friendlyAiError(message);
      },
      onEnd: async ({ isAborted, finishReason }) => {
        if (streamFailed || isAborted || finishReason === 'error') {
          await settleAgentRequest(
            false,
            isAborted ? 'Agent request aborted' : 'Agent stream failed',
            isAborted,
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
