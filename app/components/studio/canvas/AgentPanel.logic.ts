import type { UIMessage } from 'ai';
import { modelOptionsForKind } from '@/lib/studio/model-catalog';
import { stripStudioAgentEmoji } from '@/lib/studio/agent-output';
import type { StudioAgentUIMessage } from '@/lib/studio/agent-context';
import type { StudioAgentWorkflowReceipt } from '@/lib/studio/agent-workflow';
import type { StudioNode } from '@/lib/studio/types';

export interface ComposerTrigger {
  kind: 'canvas' | 'skill';
  query: string;
  start: number;
}

export function composerTriggerAtEnd(
  input: string,
): ComposerTrigger | undefined {
  const match = input.match(/(?:^|\s)([@/])([^\s@/]*)$/u);
  if (!match || match.index === undefined) return undefined;
  const marker = match[1];
  return {
    kind: marker === '@' ? 'canvas' : 'skill',
    query: match[2],
    start: match.index + match[0].indexOf(marker),
  };
}

export function removeComposerTrigger(
  input: string,
  trigger: ComposerTrigger,
) {
  return input.slice(0, trigger.start);
}

export function filterCanvasMentionNodes(
  nodes: readonly StudioNode[],
  query: string,
  excludedIds: readonly string[],
) {
  const excluded = new Set(excludedIds);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return nodes.filter((node) => {
    if (excluded.has(node.id)) return false;
    if (!normalizedQuery) return true;
    return [
      node.id,
      node.type,
      node.data.title,
      node.data.prompt,
      node.data.text,
      node.data.modelId,
      node.data.status,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
}

export function workflowReceiptFromPart(
  part: unknown,
): StudioAgentWorkflowReceipt | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const candidate = part as Record<string, unknown>;
  if (
    typeof candidate.type !== 'string' ||
    !candidate.type.startsWith('tool-') ||
    !('output' in candidate)
  ) {
    return undefined;
  }
  const output = candidate.output;
  if (!output || typeof output !== 'object') return undefined;
  const workflow = (output as { workflow?: unknown }).workflow;
  if (!workflow || typeof workflow !== 'object') return undefined;
  const value = workflow as Record<string, unknown>;
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    !Array.isArray(value.nodes)
  ) {
    return undefined;
  }
  const nodes = value.nodes.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const node = item as Record<string, unknown>;
    if (
      typeof node.id !== 'string' ||
      typeof node.key !== 'string' ||
      !['image', 'video', 'text'].includes(String(node.kind)) ||
      typeof node.title !== 'string' ||
      typeof node.modelId !== 'string' ||
      !Array.isArray(node.dependsOn) ||
      node.dependsOn.some((id) => typeof id !== 'string') ||
      typeof node.autoGenerate !== 'boolean'
    ) {
      return [];
    }
    return [
      {
        id: node.id,
        key: node.key,
        kind: node.kind as 'image' | 'video' | 'text',
        title: node.title,
        modelId: node.modelId,
        dependsOn: node.dependsOn as string[],
        autoGenerate: node.autoGenerate,
      },
    ];
  });
  if (nodes.length !== value.nodes.length) return undefined;
  return {
    id: value.id,
    title: value.title,
    groupId: typeof value.groupId === 'string' ? value.groupId : undefined,
    nodes,
  };
}

export function workflowProgress(
  workflow: StudioAgentWorkflowReceipt,
  nodes: readonly StudioNode[],
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const statuses = workflow.nodes.map((receipt) => {
    const node = byId.get(receipt.id);
    return node?.data.status ?? 'idle';
  });
  const ready = statuses.filter((status) => status === 'ready').length;
  const errors = statuses.filter((status) => status === 'error').length;
  const running = statuses.filter(
    (status) => status === 'generating' || status === 'uploading',
  ).length;
  return {
    ready,
    errors,
    running,
    total: statuses.length,
    complete: statuses.length > 0 && ready === statuses.length,
  };
}

export function workflowReceiptsFromMessages(
  messages: readonly UIMessage[],
) {
  const workflows = new Map<string, StudioAgentWorkflowReceipt>();
  for (const message of messages) {
    for (const part of message.parts) {
      const workflow = workflowReceiptFromPart(part);
      if (workflow) workflows.set(workflow.id, workflow);
    }
  }
  return [...workflows.values()];
}

export function studioWorkflowLanguage(
  messages: readonly UIMessage[],
  workflowId: string,
): 'en' | 'zh' {
  let language: 'en' | 'zh' = 'en';
  for (const message of messages) {
    if (message.role === 'user') {
      const text = message.parts
        .flatMap((part) => (part.type === 'text' ? [part.text] : []))
        .join(' ');
      if (text.trim()) language = /[\u3400-\u9fff]/u.test(text) ? 'zh' : 'en';
    }
    if (
      message.parts.some(
        (part) => workflowReceiptFromPart(part)?.id === workflowId,
      )
    ) {
      return language;
    }
  }
  return language;
}

export function studioWorkflowSummaryMessageId(workflowId: string) {
  return `studio-run-summary:${workflowId}`;
}

export function isStudioWorkflowSettled(
  workflow: StudioAgentWorkflowReceipt,
  nodes: readonly StudioNode[],
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return workflow.nodes.every((receipt) => {
    const node = byId.get(receipt.id);
    return Boolean(
      node &&
        (node.data.status === 'ready' ||
          node.data.status === 'error' ||
          (node.data.status === 'idle' && !receipt.autoGenerate)),
    );
  });
}

function readableCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function readyOutputSummary(
  workflow: StudioAgentWorkflowReceipt,
  nodes: readonly StudioNode[],
  language: 'en' | 'zh',
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const counts = { image: 0, video: 0, text: 0 };
  for (const receipt of workflow.nodes) {
    if (byId.get(receipt.id)?.data.status === 'ready') {
      counts[receipt.kind] += 1;
    }
  }
  return (language === 'zh'
    ? [
        counts.image ? `${counts.image} 张图片` : '',
        counts.video ? `${counts.video} 段视频` : '',
        counts.text ? `${counts.text} 个文本节点` : '',
      ]
    : [
        counts.image ? readableCount(counts.image, 'image') : '',
        counts.video ? readableCount(counts.video, 'video') : '',
        counts.text ? readableCount(counts.text, 'text node') : '',
      ])
    .filter(Boolean)
    .join(language === 'zh' ? '、' : ', ');
}

export function buildStudioWorkflowSummaryMessage(
  workflow: StudioAgentWorkflowReceipt,
  nodes: readonly StudioNode[],
  language: 'en' | 'zh' = 'en',
): StudioAgentUIMessage | undefined {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const workflowNodes = workflow.nodes.map((receipt) => ({
    receipt,
    node: byId.get(receipt.id),
  }));
  if (!isStudioWorkflowSettled(workflow, nodes)) {
    return undefined;
  }

  const failures = workflowNodes.filter(
    ({ node }) => node?.data.status === 'error',
  );
  const models = [
    ...new Set(
      workflow.nodes.map((receipt) =>
        modelOptionsForKind(receipt.kind).find(
          (option) => option.id === receipt.modelId,
        )?.label || receipt.modelId,
      ),
    ),
  ];
  const outputs = readyOutputSummary(workflow, nodes, language);
  const readyCount = workflowNodes.filter(
    ({ node }) => node?.data.status === 'ready',
  ).length;
  const failureList = failures
    .map(({ receipt, node }) => {
      const error = stripStudioAgentEmoji(
        typeof node?.data.error === 'string'
          ? node.data.error
          : language === 'zh'
            ? '生成失败。'
            : 'Generation failed.',
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);
      return `- ${stripStudioAgentEmoji(receipt.title)}: ${error}`;
    })
    .join('\n');
  const text =
    language === 'zh'
      ? failures.length
        ? [
            `**任务结束，${failures.length} 个任务失败。** ${outputs ? `${outputs}已在画布上就绪。` : '没有请求的内容成功生成。'}`,
            failureList,
            '你可以修改失败节点，或让我更换模型后重新生成。',
          ].join('\n\n')
        : `**任务已完成。** ${outputs || '请求的画布内容'}已在画布上就绪。使用模型：${models.join('、')}。`
      : failures.length
        ? [
            `**Run finished with ${readableCount(failures.length, 'failed task')}.** ${outputs ? `${outputs} ${readyCount === 1 ? 'is' : 'are'} ready on the canvas.` : 'No requested output completed.'}`,
            failureList,
            'You can revise the failed node or ask me to rerun it with a different model.',
          ].join('\n\n')
        : `**Run complete.** ${outputs ? `${outputs} ${readyCount === 1 ? 'is' : 'are'}` : 'The requested canvas work is'} ready on the canvas. Models used: ${models.join(', ')}.`;

  return {
    id: studioWorkflowSummaryMessageId(workflow.id),
    role: 'assistant',
    metadata: {
      studioRun: {
        workflowId: workflow.id,
        status: failures.length ? 'failed' : 'completed',
      },
    },
    parts: [{ type: 'text', text }],
  };
}
