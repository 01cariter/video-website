import 'server-only';

import { isStepCount, ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { STUDIO_CHAT_MODEL } from './models';

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
  if (!canvas.length) return '画布目前是空的。';
  return canvas
    .map(
      (node) =>
        `- ${node.kind} ${node.id}「${node.title}」状态 ${node.status}；位置 ${Math.round(node.x || 0)},${Math.round(node.y || 0)}；提示：${node.prompt || '（空）'}`,
    )
    .join('\n');
}

const kindSchema = z.enum(['image', 'video', 'text', 'section']);

export function createStudioAgent(
  canvas: CanvasNodeSnapshot[],
  onEnd?: () => Promise<void> | void,
) {
  return new ToolLoopAgent({
    id: 'snackd-canvas-agent',
    model: STUDIO_CHAT_MODEL,
    stopWhen: isStepCount(8),
    instructions: `你是 Snackd CreatorStudio 的专业 AI 画布 Agent。你操作的是 LeaferJS 无限画布。

工作规则：
- 用简洁中文沟通，先理解创作目标，再用工具直接改画布。
- 图片需求使用 image；镜头、运动、短片使用 video；文案或分镜字卡使用 text；需要组织内容时使用 section。
- 新建生成节点时必须给出可直接生成的高质量 prompt。客户端会自动发起生成。
- 一次优先创建 1–3 个关键节点；系列方案可创建更多，但要用 section 分组并合理排布。
- 更新已有内容时优先 updateCanvasNode，不要无意义重复创建。
- 删除前必须确认用户有明确删除意图。
- 节点坐标以画布世界坐标为准，常用尺寸：图片 300×300、视频 300×169、文本 280×176、分组 720×460。
- 工具完成后，用一两句话说明已经做了什么，不要暴露内部工具细节。

当前画布：
${inventoryText(canvas)}`,
    tools: {
      addCanvasNode: tool({
        description:
          '在无限画布添加图片、视频、文本或分组节点。图片/视频/文本带 prompt 时会自动生成。',
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
        description: '修改已有节点的内容、生成要求、位置或尺寸。',
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
        description: '删除用户明确要求移除的一个或多个画布节点。',
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
