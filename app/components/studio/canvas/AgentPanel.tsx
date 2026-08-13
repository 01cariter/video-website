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
  if (type.includes('Image')) return '添加图片节点';
  if (type.includes('Video')) return '添加视频节点';
  if (type.includes('Text')) return '添加文本节点';
  if (type.includes('generate')) return '正在生成';
  return type.replace(/^tool-/, '');
}

export default function AgentPanel({
  open,
  onClose,
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
          className="absolute inset-y-3 right-3 z-20 flex w-[min(348px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_28px_64px_-32px_color-mix(in_srgb,var(--ink)_58%,transparent)] backdrop-blur-xl"
          aria-label="Agent 面板"
          initial={reduceMotion ? false : { opacity: 0, x: 18, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: 12, scale: 0.985 }}
          transition={studioSnap}
        >
          <header className="flex h-10 shrink-0 items-center justify-between px-3.5">
            <span className="text-[14px] font-semibold tracking-tight">{empty ? '新对话' : 'Agent'}</span>
            <Button type="button" variant="ghost" size="icon-xs" onClick={onClose} aria-label="收起 Agent">
              <X />
            </Button>
          </header>

          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
            {empty ? (
              <motion.div
                className="flex h-full flex-col items-center justify-center gap-5 px-4 pb-8"
                initial={reduceMotion ? false : 'hidden'}
                animate="show"
                variants={studioStagger}
              >
                <motion.p
                  variants={studioItem}
                  className="text-center text-[15px] font-semibold tracking-tight"
                >
                  试试这些做法
                </motion.p>
                <motion.div variants={studioItem} className="flex max-w-[300px] flex-wrap justify-center gap-2">
                  {SKILLS.map((skill) => {
                    const Icon = skill.icon;
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-[12.5px] leading-none transition-colors hover:bg-accent/70"
                        onClick={() => onSend(skill.prompt)}
                      >
                        <Icon className={cn('size-3.5', skill.tone)} />
                        {skill.label}
                      </button>
                    );
                  })}
                </motion.div>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-3.5 px-4 py-3 pb-4">
                {messages.map((message) => (
                  <motion.article
                    key={message.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={studioSnap}
                    className={
                      message.role === 'user'
                        ? 'ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-accent px-3 py-2'
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
            className="mx-2.5 mb-2.5 flex flex-col gap-2 rounded-[22px] bg-[var(--field)] px-3 pt-3 pb-2.5 shadow-[inset_0_0_0_1px_var(--line)]"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Textarea
              value={input}
              rows={3}
              placeholder="从一句想法开始…"
              className="min-h-16 resize-none border-0 bg-transparent px-0.5 py-0 shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0"
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
                  <Button type="button" variant="ghost" size="icon-xs" className="rounded-full" aria-label="在画布上添加">
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
                <Button type="button" size="icon-sm" className="rounded-full" onClick={onStop} aria-label="停止">
                  <Square className="size-3" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon-sm"
                  disabled={!canSend}
                  aria-label="发送"
                  className="rounded-full bg-[var(--ink)] text-[var(--field)] hover:bg-[var(--ink)]/90 disabled:bg-[var(--ink)]/25 disabled:text-[var(--field)]"
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
