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
import {
  buildStudioAgentWorkflow,
  studioAgentModelContractText,
} from './agent-workflow';
import { cleanStudioAgentText } from './agent-output';

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
const generativeKindSchema = z.enum(['image', 'video', 'text']);
const workflowParameterSchema = z.union([
  z.string().max(160),
  z.number().finite(),
  z.boolean(),
]);
const workflowParametersSchema = z
  .record(z.string().max(60), workflowParameterSchema)
  .refine((value) => Object.keys(value).length <= 20, {
    message: 'A node can configure at most 20 parameters.',
  });
const workflowNodeSchema = z.object({
  key: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/)
    .describe('A local key used by dependency and reference fields.'),
  kind: generativeKindSchema,
  title: z.string().max(80).optional(),
  prompt: z.string().min(1).max(4000),
  text: z.string().max(8000).optional(),
  modelId: z.string().max(160).optional(),
  parameters: workflowParametersSchema.optional(),
  dependsOn: z.array(z.string().max(160)).max(24).optional(),
  referenceNodeIds: z
    .array(z.string().max(160))
    .max(8)
    .optional()
    .describe(
      'Canvas node IDs or workflow keys whose ready image assets should be used as references.',
    ),
  generate: z
    .boolean()
    .optional()
    .describe('Defaults to true. Use false only when the user asks for a draft.'),
});

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
    instructions: `You are the professional AI canvas Agent in Snackd Creator Studio. You operate a LeaferJS infinite canvas and execute creative work to completion.

Working rules:
- Respond concisely in the language used by the user. Understand the creative goal, then use tools to edit the canvas directly.
- Never use emoji in messages, reasoning, tool inputs, node names, prompts, or generated text. Use plain words and interface icons only.
- Use image for image requests; video for shots, motion, or clips; text for copy or storyboard cards; and section to organize related content.
- When the user asks you to make or generate content, create configured generator nodes AND start generation. Do not stop after creating drafts. Draft-only nodes are allowed only when explicitly requested.
- For a multi-stage request, call createCanvasWorkflow once with the full dependency graph. The client waits for prerequisite generations, attaches their real assets, and then starts dependent generations even after this response ends.
- Every generated node must include a production-ready prompt, an explicit modelId, and deliberate parameters. Map natural names such as Grok and Hailuo to the exact enabled IDs below. Follow explicit user choices; otherwise select the model and parameters that best fit the requested medium, aspect, quality, duration, and cost.
- For image-to-video work, put the image node key or existing canvas image ID in the video's referenceNodeIds. This also creates the generation dependency. If several storyboard frames need motion, create one video per frame; if the user asks for one final video, select the strongest lead frame unless a real video composition capability is available. Never claim clips were merged when they were not.
- Selected image and video-poster attachments are included as user image parts when available. Inspect their visible content and use it together with the canvas prompt and metadata; do not pretend to see an attachment that was not provided as an image part.
- Use separate image nodes for distinct storyboard shots instead of one multi-output node. Multi-node workflows are automatically grouped; keep related later nodes in that workflow group.
- Prefer only the essential nodes needed for the requested outcome. A series may use more, but avoid filler.
- Use createCanvasVariant when revising generated work. Preserve the source node and inherit its model, parameters, and references. Use updateCanvasNode only for names, text, and layout.
- You cannot delete canvas content. If deletion is requested, tell the user to confirm it with the canvas toolbar.
- Respect the enabled model policy enforced by the generation endpoints. AI Gateway account credits are not a per-model capability.
- Let the client place new Agent nodes together in the nearest blank gridded region. Never invent creation coordinates. Use updateCanvasNode only when the user explicitly requests a layout change.
- A scheduling receipt is not task completion. After tools return, say only that execution has started and the run supervisor will report when every generated node settles. Do not repeat the full task list already shown in the workflow card.
- The persistent run supervisor observes real node results, waits across dependency chains, and adds the final completion or failure summary. Never claim completion, success, readiness, or final output in this planning turn.
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
${canvasInventoryText(canvas)}

Enabled model and parameter contracts:
${studioAgentModelContractText(runtime)}`,
    tools: {
      ...skillTools,
      createCanvasWorkflow: tool({
        description:
          'Create and automatically execute a complete multi-node creative workflow. Use this for scripts plus storyboards, image-to-video, multiple shots, or any request with dependencies. References can point to existing canvas node IDs or local workflow keys.',
        inputSchema: z.object({
          title: z.string().max(120).optional(),
          groupTitle: z.string().max(80).optional(),
          nodes: z.array(workflowNodeSchema).min(1).max(16),
        }),
        execute: async (workflow, { toolCallId }) =>
          buildStudioAgentWorkflow({
            workflow,
            toolCallId,
            canvasNodeIds: canvas.map((node) => node.id),
            runtime,
          }),
      }),
      addCanvasNode: tool({
        description:
          'Add one canvas node. Generated image, video, and text nodes start automatically unless generate is false. Use createCanvasWorkflow for multiple nodes or dependencies.',
        inputSchema: z.object({
          kind: kindSchema,
          title: z.string().max(80).optional(),
          prompt: z.string().max(4000).optional(),
          text: z.string().max(8000).optional(),
          modelId: z.string().max(160).optional(),
          parameters: workflowParametersSchema.optional(),
          generate: z.boolean().optional(),
          width: z.number().min(80).max(2400).optional(),
          height: z.number().min(60).max(2400).optional(),
        }),
        execute: async (node, { toolCallId }) => {
          if (node.kind === 'section') {
            return {
              operation: {
                type: 'add_node' as const,
                node: {
                  ...node,
                  id: studioAgentOperationId(toolCallId),
                  title: cleanStudioAgentText(node.title),
                  prompt: cleanStudioAgentText(node.prompt),
                  text: cleanStudioAgentText(node.text),
                },
              },
            };
          }
          const result = buildStudioAgentWorkflow({
            workflow: {
              title: node.title,
              nodes: [
                {
                  key: 'node',
                  kind: node.kind,
                  title: node.title,
                  prompt: node.prompt || node.text || 'Create the requested content.',
                  text: node.text,
                  modelId: node.modelId,
                  parameters: node.parameters,
                  generate: node.generate,
                },
              ],
            },
            toolCallId,
            canvasNodeIds: canvas.map((item) => item.id),
            runtime,
          });
          const operation = result.operations[0];
          if (
            operation.type === 'add_node' &&
            typeof node.width === 'number' &&
            typeof node.height === 'number'
          ) {
            operation.node.width = node.width;
            operation.node.height = node.height;
          }
          return {
            workflow: result.workflow,
            operations: [operation],
          };
        },
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
              prompt: cleanStudioAgentText(prompt),
              title: cleanStudioAgentText(title),
              autoGenerate: true,
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
            operation: {
              type: 'update_node' as const,
              id,
              patch: {
                ...patch,
                ...(patch.title !== undefined
                  ? { title: cleanStudioAgentText(patch.title) }
                  : {}),
                ...(patch.text !== undefined
                  ? { text: cleanStudioAgentText(patch.text) }
                  : {}),
              },
            },
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
