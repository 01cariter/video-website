import 'server-only';

import { isStepCount, ToolLoopAgent, tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { chatModelId } from './model-catalog';
import { isStudioSkillId, type StudioSkillId } from './skills/catalog';
import {
  readStudioSkillResource,
  studioSkillSelectionText,
} from './skills/server';

export interface CanvasNodeSnapshot {
  id: string;
  kind: string;
  title: string;
  prompt: string;
  status: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

function inventoryText(canvas: CanvasNodeSnapshot[]) {
  if (!canvas.length) return 'The canvas is currently empty.';
  return canvas
    .map(
      (node) =>
        `- ${node.kind} ${node.id} "${node.title}" — status: ${node.status}; position: ${Math.round(node.x || 0)},${Math.round(node.y || 0)}; prompt: ${node.prompt || '(empty)'}`,
    )
    .join('\n');
}

const kindSchema = z.enum(['image', 'video', 'text', 'section']);

export function createStudioAgent(
  canvas: CanvasNodeSnapshot[],
  freeCreditModelsOnly = false,
  onEnd?: () => Promise<void> | void,
  skillIds: readonly StudioSkillId[] = [],
) {
  const activeSkillText = studioSkillSelectionText(skillIds);
  const skillTools: ToolSet = {};
  if (skillIds.length) {
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
        return {
          type: 'text' as const,
          value: await readStudioSkillResource(
            skillIds,
            selection.skillId,
            selection.resource,
          ),
        };
      },
    });
  }

  return new ToolLoopAgent({
    id: 'snackd-canvas-agent',
    model: chatModelId(freeCreditModelsOnly),
    stopWhen: isStepCount(8),
    instructions: `You are the professional AI canvas Agent in Snackd Creator Studio. You operate a LeaferJS infinite canvas.

Working rules:
- Respond concisely in the language used by the user. Understand the creative goal, then use tools to edit the canvas directly.
- Use image for image requests; video for shots, motion, or clips; text for copy or storyboard cards; and section to organize related content.
- Every new generation node must include a production-ready prompt. The client starts generation automatically.
- Prefer one to three essential nodes per step. A series may use more, but group and arrange them clearly with sections.
- Prefer updateCanvasNode when revising existing work. Do not create redundant nodes.
- Confirm that the user clearly intends deletion before removing anything.
- ${
      freeCreditModelsOnly
        ? 'Free-credit mode is active. Do not create video generation nodes because no video model is currently available in this mode.'
        : 'All configured generation models are available.'
    }
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
${inventoryText(canvas)}`,
    tools: {
      ...skillTools,
      addCanvasNode: tool({
        description:
          'Add image, video, text, or section nodes to the infinite canvas. Image, video, and text nodes generate automatically when a prompt is provided.',
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
        execute: async (node) => ({
          operation: { type: 'add_node' as const, node },
        }),
      }),
      updateCanvasNode: tool({
        description:
          'Update the content, generation prompt, position, or size of an existing node.',
        inputSchema: z.object({
          id: z.string(),
          patch: z.object({
            title: z.string().max(80).optional(),
            prompt: z.string().max(4000).optional(),
            text: z.string().max(8000).optional(),
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().min(40).max(2400).optional(),
            height: z.number().min(40).max(2400).optional(),
          }),
        }),
        execute: async ({ id, patch }) => ({
          operation: { type: 'update_node' as const, id, patch },
        }),
      }),
      removeCanvasNodes: tool({
        description:
          'Remove one or more canvas nodes only when the user clearly asks for deletion.',
        inputSchema: z.object({
          ids: z.array(z.string()).min(1).max(50),
        }),
        execute: async ({ ids }) => ({
          operation: { type: 'remove_nodes' as const, ids },
        }),
      }),
    },
    onEnd: onEnd ? async () => onEnd() : undefined,
  });
}
