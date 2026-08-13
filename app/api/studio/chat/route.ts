import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { z } from 'zod';
import { friendlyAiError } from '@/lib/studio/errors';
import { STUDIO_CHAT_MODEL } from '@/lib/studio/models';

export const maxDuration = 60;

interface CanvasNodeSnapshot {
  id: string;
  kind: string;
  title: string;
  prompt: string;
  status: string;
}

export async function POST(req: Request) {
  const {
    messages,
    canvas = [],
  }: { messages: UIMessage[]; canvas?: CanvasNodeSnapshot[] } = await req.json();

  const inventory =
    canvas.length === 0
      ? '画布目前是空的。'
      : canvas
          .map((node) => `- ${node.kind} ${node.id}「${node.title}」状态 ${node.status} 提示：${node.prompt || '（空）'}`)
          .join('\n');

  const result = streamText({
    model: STUDIO_CHAT_MODEL,
    instructions: `你是 Snackd CreatorStudio 的画布 Agent。用简洁中文对话，并在需要时调用工具把节点放到无限画布上。
原则：
- 用户要图，调用 addImageNode。
- 用户要视频或镜头运动，调用 addVideoNode。
- 用户要文案、分镜字卡、品牌说明，调用 addTextNode。
- 一次不要堆太多节点，优先给最关键的 1-3 个。
- 工具返回后，用一两句话说明你做了什么。
当前画布：
${inventory}`,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(5),
    tools: {
      addImageNode: tool({
        description: '在画布上添加一个图片生成节点，并立刻按 prompt 生成。',
        inputSchema: z.object({
          prompt: z.string().describe('图像提示词'),
          title: z.string().optional().describe('节点名称'),
        }),
        execute: async ({ prompt, title }) => ({ kind: 'image' as const, prompt, title }),
      }),
      addVideoNode: tool({
        description: '在画布上添加一个视频生成节点，并立刻按 prompt 生成。',
        inputSchema: z.object({
          prompt: z.string().describe('视频提示词，包含镜头运动'),
          title: z.string().optional().describe('节点名称'),
        }),
        execute: async ({ prompt, title }) => ({ kind: 'video' as const, prompt, title }),
      }),
      addTextNode: tool({
        description: '在画布上添加一个文本节点，并按 prompt 写内容。',
        inputSchema: z.object({
          prompt: z.string().describe('写作要求'),
          title: z.string().optional().describe('节点名称'),
          text: z.string().optional().describe('若已有草稿可带上'),
        }),
        execute: async ({ prompt, title, text }) => ({ kind: 'text' as const, prompt, title, text }),
      }),
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => friendlyAiError(error instanceof Error ? error.message : 'Agent 请求失败'),
    }),
  });
}
