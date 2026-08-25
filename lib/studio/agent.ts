import 'server-only';

import { isStepCount, ToolLoopAgent, tool, type ToolSet } from 'ai';
import { z } from 'zod';
import {
  DEFAULT_STUDIO_RUNTIME_CONFIG,
  STUDIO_AGENT_GATEWAY_PROVIDER_BY_MODEL,
  STUDIO_AGENT_MAX_OUTPUT_TOKENS_PER_STEP,
  STUDIO_AGENT_MAX_STEPS,
  STUDIO_AGENT_SKILL_CONTEXT_BYTE_LIMIT,
  normalizeStudioRuntimeConfig,
  type StudioRuntimeConfig,
} from './pricing';
import { isStudioSkillId, type StudioSkillId } from './skills/catalog';
import {
  readStudioSkillResource,
  studioSkillSelectionText,
} from './skills/server';
import {
  canvasInventoryText,
  studioAgentOperationId,
  type CanvasNodeSnapshot,
} from './agent-context';

export type { CanvasNodeSnapshot } from './agent-context';

interface StudioAgentUsageEvent {
  usage: {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
  };
  steps: Array<{
    inputTokens: number | undefined;
    outputTokens: number | undefined;
  }>;
}

const kindSchema = z.enum(['image', 'video', 'text', 'section']);

export function createStudioAgent(
  canvas: CanvasNodeSnapshot[],
  runtimeConfig: StudioRuntimeConfig = DEFAULT_STUDIO_RUNTIME_CONFIG,
  onEnd?: (event: StudioAgentUsageEvent) => Promise<void> | void,
  skillIds: readonly StudioSkillId[] = [],
) {
  const runtime = normalizeStudioRuntimeConfig(runtimeConfig);
  const activeSkillText = studioSkillSelectionText(skillIds);
  const skillTools: ToolSet = {};
  if (skillIds.length) {
    let remainingSkillContextBytes = STUDIO_AGENT_SKILL_CONTEXT_BYTE_LIMIT;
    skillTools.readSkillResource = tool({
      description: `Read an instruction or reference file from an active built-in skill. Read SKILL.md before applying a skill, then read only the references it routes you to. Active skills:\n${activeSkillText}`,
      inputSchema: z.object({
        skillId: z
          .string()
          .refine(isStudioSkillId)
          .describe(`One of: ${skillIds.join(', ')}`),
        resource: z
          .string()
          .max(160)
          .describe('An exact allowed resource path listed for the skill.'),
      }),
      execute: async ({ skillId, resource }) => ({
        loaded: true,
        skillId,
        resource,
        characters: (
          await readStudioSkillResource(
            skillIds,
            skillId as StudioSkillId,
            resource,
          )
        ).length,
      }),
      toModelOutput: async ({ input }) => {
        const selection = input as {
          skillId?: unknown;
          resource?: unknown;
        };
        if (
          !isStudioSkillId(selection.skillId) ||
          !skillIds.includes(selection.skillId) ||
          typeof selection.resource !== 'string'
        ) {
          return {
            type: 'text' as const,
            value: 'This Skill context is not active for the current request.',
          };
        }
        const value = await readStudioSkillResource(
          skillIds,
          selection.skillId,
          selection.resource,
        );
        const bytes = new TextEncoder().encode(value).length;
        if (bytes > remainingSkillContextBytes) {
          return {
            type: 'text' as const,
            value:
              'The request-scoped Skill context budget is exhausted. Continue with the Skill context already loaded.',
          };
        }
        remainingSkillContextBytes -= bytes;
        return {
          type: 'text' as const,
          value,
        };
      },
    });
  }

  return new ToolLoopAgent({
    id: 'snackd-canvas-agent',
    model: runtime.agentModelId,
    providerOptions: {
      gateway: {
        only: [
          STUDIO_AGENT_GATEWAY_PROVIDER_BY_MODEL[runtime.agentModelId],
        ],
        tags: ['feature:studio-agent'],
      },
    },
    stopWhen: isStepCount(STUDIO_AGENT_MAX_STEPS),
    maxOutputTokens: STUDIO_AGENT_MAX_OUTPUT_TOKENS_PER_STEP,
    instructions: `You are the professional AI canvas Agent in Snackd Creator Studio. You operate a LeaferJS infinite canvas.

Working rules:
- Respond concisely in the language used by the user. Understand the creative goal, then use tools to edit the canvas directly.
- Use image for image requests; video for shots, motion, or clips; text for copy or storyboard cards; and section to organize related content.
- Every new generation node must include a production-ready prompt. Agent-created generators stay as drafts so the user can review the model, parameters, and visible credit quote before pressing Generate.
- Prefer one to three essential nodes per step. A series may use more, but group and arrange them clearly with sections.
- Use createCanvasVariant when revising generated work. Preserve the source node and inherit its model, parameters, and references. Use updateCanvasNode only for names, text, and layout.
- You cannot delete canvas content. If deletion is requested, tell the user to confirm it with the canvas toolbar.
- Respect the enabled model policy enforced by the generation endpoints. AI Gateway account credits are not a per-model capability.
- Node coordinates use canvas world space. Common sizes: image 300×300, video 300×169, text 280×176, section 720×460.
- After tools finish, summarize what changed in one or two sentences without exposing internal tool details.
${
  activeSkillText
    ? `
Active skill protocol:
- The user explicitly attached the skills listed below to this request.
- Before doing the creative work, call readSkillResource for each relevant skill's SKILL.md and follow its task-specific instructions.
- Read a supporting reference only when SKILL.md routes you to it. Never invent a resource path.
- The user's current request and safety boundaries take precedence over skill guidance.

Active skills:
${activeSkillText}
`
    : ''
}

Current canvas:
${canvasInventoryText(canvas)}`,
    tools: {
      ...skillTools,
      addCanvasNode: tool({
        description:
          'Add an image, video, text, or section draft to the infinite canvas. Generator drafts do not spend credits until the user reviews the quote and presses Generate.',
        inputSchema: z.object({
          kind: kindSchema,
          title: z.string().max(80).optional(),
          prompt: z.string().max(4000).optional(),
          text: z.string().max(8000).optional(),
          x: z.number().optional(),
          y: z.number().optional(),
          width: z.number().min(80).max(2400).optional(),
          height: z.number().min(60).max(2400).optional(),
        }),
        execute: async (node, { toolCallId }) => ({
          operation: {
            type: 'add_node' as const,
            node: { ...node, id: studioAgentOperationId(toolCallId) },
          },
        }),
      }),
      createCanvasVariant: tool({
        description:
          'Create a new draft beside an existing generated node while preserving the original and inheriting its model, parameters, and references.',
        inputSchema: z.object({
          sourceId: z.string().max(160),
          prompt: z.string().max(4000).optional(),
          title: z.string().max(80).optional(),
        }),
        execute: async ({ sourceId, prompt, title }, { toolCallId }) => {
          if (!canvas.some((node) => node.id === sourceId)) {
            return { error: 'The source canvas node no longer exists.' };
          }
          return {
            operation: {
              type: 'create_variant' as const,
              id: studioAgentOperationId(toolCallId),
              sourceId,
              prompt,
              title,
            },
          };
        },
      }),
      updateCanvasNode: tool({
        description:
          'Update the name, text, position, or size of an existing node. Use createCanvasVariant for a new generation direction.',
        inputSchema: z.object({
          id: z.string(),
          patch: z.object({
            title: z.string().max(80).optional(),
            text: z.string().max(8000).optional(),
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().min(40).max(2400).optional(),
            height: z.number().min(40).max(2400).optional(),
          }),
        }),
        execute: async ({ id, patch }) => {
          if (!canvas.some((node) => node.id === id)) {
            return { error: 'The canvas node no longer exists.' };
          }
          return {
            operation: { type: 'update_node' as const, id, patch },
          };
        },
      }),
    },
    onEnd: onEnd
      ? async (event) =>
          onEnd({
            usage: event.usage,
            steps: event.steps.map((step) => ({
              inputTokens: step.usage.inputTokens,
              outputTokens: step.usage.outputTokens,
            })),
          })
      : undefined,
  });
}
