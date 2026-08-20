'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowUp,
  Clapperboard,
  FileText,
  ImageIcon,
  Layers,
  Play,
  Plus,
  Sparkles,
  Square,
  Type,
  Video,
  X,
} from 'lucide-react';
import type { UIMessage } from 'ai';
import {
  studioItem,
  studioSnap,
  studioStagger,
  studioTween,
} from '@/lib/studio/motion';
import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import {
  AgentActivity,
  AgentReasoning,
  AgentThinking,
} from '@/app/components/ui/agent-activity';
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
  draftRequest?: { id: number; text: string } | null;
}

const SKILLS = [
  {
    id: 'seedance',
    label: 'Seedance video',
    icon: Play,
    tone: 'text-[var(--study)]',
    prompt:
      'Create a five-second Seedance product video on the canvas with warm light, a slow push-in, and clear packaging texture.',
  },
  {
    id: 'onelong',
    label: 'Single-take shot',
    icon: Play,
    tone: 'text-[var(--study)]',
    prompt:
      'Create a single-take clip that moves from an empty tabletop down to the product without a cut.',
  },
  {
    id: 'hero',
    label: 'Package hero',
    icon: ImageIcon,
    tone: 'text-[var(--orange)]',
    prompt:
      'Create a production-ready package hero image with a warm stone background, centered product, and room for the brand name.',
  },
  {
    id: 'series',
    label: 'Poster series',
    icon: Layers,
    tone: 'text-[var(--orange)]',
    prompt:
      'Create three posters in one visual system. Vary the composition while keeping materials and lighting consistent.',
  },
  {
    id: 'story',
    label: 'Storyboard',
    icon: Clapperboard,
    tone: 'text-[var(--orange-d)]',
    prompt:
      'Break the current direction into three consecutive shots and arrange them on the canvas.',
  },
  {
    id: 'copy',
    label: 'Package copy',
    icon: Type,
    tone: 'text-muted-foreground',
    prompt:
      'Write concise package copy with a product name, one benefit, and one use case.',
  },
] as const;

function textOf(message: UIMessage) {
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map((part) => part.text)
    .join('');
}

function toolLabel(type: string) {
  if (type.includes('addCanvasNode')) return 'Add canvas node';
  if (type.includes('updateCanvasNode')) return 'Update canvas node';
  if (type.includes('removeCanvasNodes')) return 'Remove canvas nodes';
  if (type.includes('Image')) return 'Add image node';
  if (type.includes('Video')) return 'Add video node';
  if (type.includes('Text')) return 'Add text node';
  if (type.includes('generate')) return 'Generate content';
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
  draftRequest,
}: AgentPanelProps) {
  const { addNode } = useStudioCanvas();
  const [inputState, setInputState] = useState<{
    draftId: number | null;
    value: string;
  }>({ draftId: null, value: '' });
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const busy = status === 'submitted' || status === 'streaming';
  const empty = messages.length === 0;
  const activeDraftId = draftRequest?.id ?? null;
  const input =
    draftRequest && inputState.draftId !== activeDraftId
      ? draftRequest.text
      : inputState.value;
  const canSend = input.trim().length > 0 && status === 'ready';

  const setInput = (value: string) =>
    setInputState({ draftId: activeDraftId, value });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    if (!open || !draftRequest) return;
    const frame = window.requestAnimationFrame(() => {
      const input = inputRef.current;
      input?.focus();
      input?.setSelectionRange(
        draftRequest.text.length,
        draftRequest.text.length,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draftRequest, open]);

  function submit() {
    if (!canSend) return;
    onSend(input.trim());
    setInput('');
  }

  if (!open) return null;

  return (
    <motion.aside
      key="agent-panel"
      className="absolute inset-0 z-40 flex w-full flex-col overflow-hidden bg-card md:relative md:inset-auto md:z-10 md:w-[360px] md:shrink-0 md:border-l md:border-border"
      aria-label="Agent panel"
      initial={reduceMotion ? false : { opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: 14 }}
      transition={studioTween}
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
              {title || 'Untitled project'}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="Collapse Agent"
        >
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
            <motion.p
              variants={studioItem}
              className="text-[14px] font-semibold tracking-tight"
            >
              Start with a creative direction
            </motion.p>
            <motion.p
              variants={studioItem}
              className="mt-1.5 max-w-[260px] text-[12px] leading-5 text-muted-foreground"
            >
              The Agent reads the current canvas and can create, organize, or
              revise content directly.
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
                  <span className="text-[11px] font-bold text-muted-foreground">
                    Agent
                  </span>
                ) : null}
                {message.parts.map((part, index) => {
                  if (part.type === 'text' && part.text) {
                    return (
                      <p
                        key={`${message.id}-t-${index}`}
                        className="whitespace-pre-wrap text-[13.5px] leading-relaxed"
                      >
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type === 'reasoning' && part.text) {
                    return (
                      <AgentReasoning key={`${message.id}-r-${index}`}>
                        {part.text}
                      </AgentReasoning>
                    );
                  }
                  if (part.type.startsWith('tool-')) {
                    const state = 'state' in part ? String(part.state) : '';
                    return (
                      <AgentActivity
                        key={`${message.id}-tool-${index}`}
                        label={toolLabel(part.type)}
                        state={
                          state.includes('streaming') ||
                          state === 'input-available'
                            ? 'running'
                            : state.includes('error')
                              ? 'error'
                              : 'complete'
                        }
                      />
                    );
                  }
                  return null;
                })}
                {message.role === 'assistant' && !textOf(message) && busy ? (
                  <AgentThinking label="Thinking" />
                ) : null}
              </motion.article>
            ))}
            {status === 'submitted' ? (
              <AgentThinking label="Planning the next step" />
            ) : null}
            {error ? (
              <p className="text-[12.5px] font-semibold text-destructive">
                Generation stopped. Try again.
              </p>
            ) : null}
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
          ref={inputRef}
          value={input}
          rows={3}
          placeholder="Describe an idea or ask the Agent to organize this canvas…"
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
                aria-label="Add to canvas"
              >
                <Plus />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem onSelect={() => addNode('image')}>
                <ImageIcon /> Image generator
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => addNode('video')}>
                <Video /> Video generator
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => addNode('text')}>
                <FileText /> Text
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {busy ? (
            <Button
              type="button"
              size="icon-sm"
              className="rounded-lg"
              onClick={onStop}
              aria-label="Stop"
            >
              <Square className="size-3" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              disabled={!canSend}
              aria-label="Send"
              className="rounded-lg bg-primary !text-primary-foreground hover:bg-primary/90 disabled:bg-primary/25 disabled:!text-primary-foreground/45"
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>
    </motion.aside>
  );
}
