'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUp,
  Clapperboard,
  FileText,
  ImageIcon,
  Layers,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Square,
  Type,
  Video,
  X,
} from 'lucide-react';
import type { UIMessage } from 'ai';
import { studioItem, studioSnap, studioStagger } from '@/lib/studio/motion';
import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Textarea } from '@/app/components/ui/textarea';
import { useStudioCanvas } from './studio-context';

interface AgentPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  messages: UIMessage[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  error?: Error | undefined;
  onSend: (text: string) => void;
  onStop: () => void;
}

const SKILLS = [
  {
    id: 'seedance',
    label: 'Seedance 视频',
    icon: Play,
    tone: 'text-[var(--study)]',
    prompt: '用 Seedance 在画布上做一段 5 秒产品视频：暖光、缓慢推近，突出包装材质。',
  },
  {
    id: 'onelong',
    label: '一镜到底',
    icon: Play,
    tone: 'text-[var(--study)]',
    prompt: '做一条一镜到底短片：从桌面空镜缓缓落到产品，不要切镜。',
  },
  {
    id: 'hero',
    label: '包装主视觉',
    icon: ImageIcon,
    tone: 'text-[var(--orange)]',
    prompt: '做一张能上架的包装主图：暖石色底、产品居中、留出品牌字位置。',
  },
  {
    id: 'series',
    label: '系列海报',
    icon: Layers,
    tone: 'text-[var(--orange)]',
    prompt: '按同一风格做三张系列海报，构图略作变化，保持材质和光线一致。',
  },
  {
    id: 'story',
    label: '分镜拆解',
    icon: Clapperboard,
    tone: 'text-[var(--orange-d)]',
    prompt: '把当前意图拆成三个连续镜头，并在画布上排开。',
  },
  {
    id: 'copy',
    label: '包装文案',
    icon: Type,
    tone: 'text-muted-foreground',
    prompt: '写一段能上包装的短文案：品名、一句卖点、一句使用场景。',
  },
] as const;

function textOf(message: UIMessage) {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function toolLabel(type: string) {
  if (type.includes('addCanvasNode')) return '添加画布节点';
  if (type.includes('updateCanvasNode')) return '更新画布节点';
  if (type.includes('removeCanvasNodes')) return '删除画布节点';
  if (type.includes('Image')) return '添加图片节点';
  if (type.includes('Video')) return '添加视频节点';
  if (type.includes('Text')) return '添加文本节点';
  if (type.includes('generate')) return '正在生成';
  return type.replace(/^tool-/, '');
}

export default function AgentPanel({
  open,
  onClose,
  title,
  messages,
  status,
  error,
  onSend,
  onStop,
}: AgentPanelProps) {
  const { addNode } = useStudioCanvas();
  const [input, setInput] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const busy = status === 'submitted' || status === 'streaming';
  const empty = messages.length === 0;
  const canSend = input.trim().length > 0 && status === 'ready';

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  function submit() {
    if (!canSend) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="agent-panel"
          className="absolute inset-0 z-40 flex w-full flex-col overflow-hidden bg-card md:relative md:inset-auto md:z-10 md:w-[360px] md:shrink-0 md:border-l md:border-border"
          aria-label="Agent 面板"
          initial={reduceMotion ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: 14 }}
          transition={studioSnap}
        >
          <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-3.5" />
              </span>
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-[13px] font-semibold tracking-tight">
                  Agent
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {title || '未命名项目'}
                </span>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon-xs" onClick={onClose} aria-label="收起 Agent">
              <X />
            </Button>
          </header>

          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
            {empty ? (
              <motion.div
                className="flex h-full flex-col items-center justify-center px-5 pb-8 text-center"
                initial={reduceMotion ? false : 'hidden'}
                animate="show"
                variants={studioStagger}
              >
                <motion.span
                  variants={studioItem}
                  className="mb-4 grid size-11 place-items-center rounded-xl bg-[var(--studio-raised)] text-primary shadow-[inset_0_0_0_1px_var(--line)]"
                >
                  <Sparkles className="size-[18px]" />
                </motion.span>
                <motion.p variants={studioItem} className="text-[14px] font-semibold tracking-tight">
                  从一个创作方向开始
                </motion.p>
                <motion.p
                  variants={studioItem}
                  className="mt-1.5 max-w-[260px] text-[12px] leading-5 text-muted-foreground"
                >
                  Agent 会理解当前画布，并直接创建、整理或修改内容。
                </motion.p>
                <motion.div
                  variants={studioItem}
                  className="mt-6 grid w-full max-w-[306px] grid-cols-2 gap-1.5"
                >
                  {SKILLS.map((skill) => {
                    const Icon = skill.icon;
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        className="flex min-w-0 items-center gap-2 rounded-lg bg-[var(--studio-raised)] px-2.5 py-2 text-left text-[11.5px] font-medium shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-accent/60"
                        onClick={() => onSend(skill.prompt)}
                      >
                        <Icon className={cn('size-3.5 shrink-0', skill.tone)} />
                        <span className="truncate">{skill.label}</span>
                      </button>
                    );
                  })}
                </motion.div>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-4 px-4 py-4 pb-5">
                {messages.map((message) => (
                  <motion.article
                    key={message.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={studioSnap}
                    className={
                      message.role === 'user'
                        ? 'ml-auto max-w-[88%] rounded-xl rounded-br-sm bg-accent px-3 py-2'
                        : 'flex max-w-full flex-col gap-1.5'
                    }
                  >
                    {message.role === 'assistant' ? (
                      <span className="text-[11px] font-bold text-muted-foreground">Agent</span>
                    ) : null}
                    {message.parts.map((part, index) => {
                      if (part.type === 'text' && part.text) {
                        return (
                          <p key={`${message.id}-t-${index}`} className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                            {part.text}
                          </p>
                        );
                      }
                      if (part.type === 'reasoning' && part.text) {
                        return (
                          <details key={`${message.id}-r-${index}`} className="text-xs text-muted-foreground">
                            <summary>思考</summary>
                            <pre className="mt-1.5 whitespace-pre-wrap">{part.text}</pre>
                          </details>
                        );
                      }
                      if (part.type.startsWith('tool-')) {
                        const state = 'state' in part ? String(part.state) : '';
                        return (
                          <Badge key={`${message.id}-tool-${index}`}>
                            {state.includes('streaming') || state === 'input-available' ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : null}
                            {toolLabel(part.type)}
                          </Badge>
                        );
                      }
                      return null;
                    })}
                    {message.role === 'assistant' && !textOf(message) && busy ? (
                      <span className="inline-flex gap-1.5 py-1" aria-label="正在思考">
                        <i className="size-1.5 animate-pulse rounded-full bg-primary" />
                        <i className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:120ms]" />
                        <i className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:240ms]" />
                      </span>
                    ) : null}
                  </motion.article>
                ))}
                {status === 'submitted' ? (
                  <div className="inline-flex gap-1.5 py-1" aria-label="正在思考">
                    <i className="size-1.5 animate-pulse rounded-full bg-primary" />
                    <i className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:120ms]" />
                    <i className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:240ms]" />
                  </div>
                ) : null}
                {error ? <p className="text-[12.5px] font-semibold text-destructive">生成中断了，请再试一次。</p> : null}
              </div>
            )}
          </div>

          <form
            className="mx-3 mb-3 flex flex-col gap-1.5 rounded-[14px] bg-[var(--studio-composer)] p-2 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_82%,transparent)]"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Textarea
              value={input}
              rows={3}
              placeholder="描述想法，或让 Agent 整理当前画布…"
              className="min-h-[72px] resize-none border-0 bg-transparent px-1 py-1 text-[13px] leading-5 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-lg bg-[var(--studio-raised)] shadow-[inset_0_0_0_1px_var(--line)] hover:bg-[var(--studio-raised)]"
                    aria-label="在画布上添加"
                  >
                    <Plus />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuItem onSelect={() => addNode('image')}>
                    <ImageIcon /> 图片生成器
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => addNode('video')}>
                    <Video /> 视频生成器
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => addNode('text')}>
                    <FileText /> 文本
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {busy ? (
                <Button type="button" size="icon-sm" className="rounded-lg" onClick={onStop} aria-label="停止">
                  <Square className="size-3" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon-sm"
                  disabled={!canSend}
                  aria-label="发送"
                  className="rounded-lg bg-primary !text-primary-foreground hover:bg-primary/90 disabled:bg-primary/25 disabled:!text-primary-foreground/45"
                >
                  <ArrowUp />
                </Button>
              )}
            </div>
          </form>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
