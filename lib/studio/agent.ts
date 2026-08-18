import 'server-only';

import { isStepCount, ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { chatModelId } from './model-catalog';

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
) {
  return new ToolLoopAgent({
    id: 'snackd-canvas-agent',
    model: chatModelId(freeCreditModelsOnly),
    stopWhen: isStepCount(8),
    instructions: `You are the professional AI canvas Agent in Snackd Creator Studio. You operate a LeaferJS infinite canvas.

Working rules:
- Communicate in concise English. Understand the creative goal, then use tools to edit the canvas directly.
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

Current canvas:
${inventoryText(canvas)}`,
    tools: {
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
