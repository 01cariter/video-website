'use client';

import {
  memo,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowUp,
  BookOpen,
  Check,
  FileText,
  ImageIcon,
  Plus,
  Search,
  Sparkles,
  Square,
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
import { Input } from '@/app/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
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
import {
  BUILT_IN_STUDIO_SKILLS,
  MAX_ACTIVE_STUDIO_SKILLS,
  studioSkillById,
  type StudioSkillId,
} from '@/lib/studio/skills/catalog';
import type { StudioAgentAttachment } from '@/lib/studio/agent-context';
import type { StudioNodeKind } from '@/lib/studio/types';

interface AgentPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  messages: UIMessage[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  error?: Error | undefined;
  onSend: (
    text: string,
    skillIds: StudioSkillId[],
    attachmentIds: string[],
  ) => boolean;
  onStop: () => void;
  onAddNode: (kind: StudioNodeKind) => void;
  draftRequest?: {
    id: number;
    text: string;
    attachments: StudioAgentAttachment[];
  } | null;
}

const SKILL_LIST_ID = 'studio-agent-skill-list';

function textOf(message: UIMessage) {
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map((part) => part.text)
    .join('');
}

function toolLabel(type: string) {
  if (type.includes('readSkillResource')) return 'Read Skill';
  if (type.includes('addCanvasNode')) return 'Add canvas node';
  if (type.includes('createCanvasVariant')) return 'Create canvas variant';
  if (type.includes('updateCanvasNode')) return 'Update canvas node';
  if (type.includes('removeCanvasNodes')) return 'Remove canvas nodes';
  if (type.includes('Image')) return 'Add image node';
  if (type.includes('Video')) return 'Add video node';
  if (type.includes('Text')) return 'Add text node';
  if (type.includes('generate')) return 'Generate content';
  return type.replace(/^tool-/, '');
}

function AgentPanel({
  open,
  onClose,
  title,
  messages,
  status,
  error,
  onSend,
  onStop,
  onAddNode,
  draftRequest,
}: AgentPanelProps) {
  const [inputState, setInputState] = useState<{
    draftId: number | null;
    value: string;
    attachments: StudioAgentAttachment[];
  }>({ draftId: null, value: '', attachments: [] });
  const [selectedSkillIds, setSelectedSkillIds] = useState<StudioSkillId[]>([]);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState('');
  const [activeSkillIndex, setActiveSkillIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const busy = status === 'submitted' || status === 'streaming';
  const empty = messages.length === 0;
  const activeDraftId = draftRequest?.id ?? null;
  const input =
    draftRequest && inputState.draftId !== activeDraftId
      ? draftRequest.text
      : inputState.value;
  const activeAttachments =
    draftRequest && inputState.draftId !== activeDraftId
      ? draftRequest.attachments
      : inputState.attachments;
  const activeMention = input.match(/(^|\s)[@/]([\w-]*)$/u);
  const selectedSkills = selectedSkillIds.map(studioSkillById);
  const normalizedSkillQuery = skillQuery.trim().toLowerCase();
  const visibleSkills = BUILT_IN_STUDIO_SKILLS.filter((skill) =>
    `${skill.name} ${skill.description} ${skill.category}`
      .toLowerCase()
      .includes(normalizedSkillQuery),
  );
  const canSend = input.trim().length > 0 && !busy;

  const setInput = (value: string) => {
    setInputState({
      draftId: activeDraftId,
      value,
      attachments: activeAttachments,
    });
    const mention = value.match(/(^|\s)[@/]([\w-]*)$/u);
    if (mention) {
      setSkillQuery(mention[2]);
      setActiveSkillIndex(0);
      setSkillPickerOpen(true);
    } else if (skillPickerOpen) {
      setSkillPickerOpen(false);
      setSkillQuery('');
    }
  };

  useEffect(() => {
    const el = scroller.current;
    if (!el || (!shouldAutoScroll.current && status !== 'submitted')) return;
    const frame = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      shouldAutoScroll.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, status]);

  useEffect(() => {
    if (!skillPickerOpen || !visibleSkills.length) return;
    document
      .getElementById(
        `${SKILL_LIST_ID}-${visibleSkills[activeSkillIndex]?.id ?? visibleSkills[0].id}`,
      )
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeSkillIndex, skillPickerOpen, visibleSkills]);

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
    const sent = onSend(
      input.trim(),
      selectedSkillIds,
      activeAttachments.map((attachment) => attachment.id),
    );
    if (!sent) return;
    setInputState({
      draftId: activeDraftId,
      value: '',
      attachments: [],
    });
    setSelectedSkillIds([]);
    setSkillPickerOpen(false);
    setSkillQuery('');
  }

  function removeAttachment(id: string) {
    setInputState({
      draftId: activeDraftId,
      value: input,
      attachments: activeAttachments.filter(
        (attachment) => attachment.id !== id,
      ),
    });
  }

  function selectSkill(skillId: StudioSkillId) {
    setSelectedSkillIds((current) => {
      if (current.includes(skillId)) {
        return current.filter((id) => id !== skillId);
      }
      if (current.length >= MAX_ACTIVE_STUDIO_SKILLS) return current;
      return [...current, skillId];
    });
    if (activeMention) {
      const next = input
        .slice(0, input.length - activeMention[0].length)
        .concat(activeMention[1]);
      setInput(next);
      setSkillPickerOpen(false);
      setSkillQuery('');
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleSkillPickerKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (!skillPickerOpen) return false;
    if (event.key === 'Escape') {
      event.preventDefault();
      setSkillPickerOpen(false);
      setSkillQuery('');
      return true;
    }
    if (!visibleSkills.length) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveSkillIndex((current) =>
        (current + direction + visibleSkills.length) % visibleSkills.length,
      );
      return true;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const skill = visibleSkills[activeSkillIndex] ?? visibleSkills[0];
      if (
        selectedSkillIds.includes(skill.id) ||
        selectedSkillIds.length < MAX_ACTIVE_STUDIO_SKILLS
      ) {
        selectSkill(skill.id);
      }
      return true;
    }
    return false;
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

      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={(event) => {
          const element = event.currentTarget;
          shouldAutoScroll.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            56;
        }}
      >
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
              Attach a built-in workflow, then ask the Agent to create,
              organize, or revise the canvas.
            </motion.p>
            <motion.div
              variants={studioItem}
              className="mt-6 grid w-full max-w-[306px] grid-cols-2 gap-1.5"
            >
              {BUILT_IN_STUDIO_SKILLS.slice(0, 6).map((skill) => {
                const selected = selectedSkillIds.includes(skill.id);
                const disabled =
                  !selected &&
                  selectedSkillIds.length >= MAX_ACTIVE_STUDIO_SKILLS;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    disabled={disabled}
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11.5px] font-medium shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-accent/60 disabled:opacity-40',
                      selected
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-[var(--studio-raised)]',
                    )}
                    onClick={() => selectSkill(skill.id)}
                  >
                    {selected ? (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <BookOpen className="size-3.5 shrink-0 text-[var(--orange-d)]" />
                    )}
                    <span className="truncate">{skill.name}</span>
                  </button>
                );
              })}
            </motion.div>
            <motion.p
              variants={studioItem}
              className="mt-2 text-[10.5px] text-muted-foreground"
            >
              Browse all 12 from Skills below · maximum 3 per request
            </motion.p>
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
                {error.message || 'Generation stopped. Try again.'}
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
        {activeAttachments.length ? (
          <div
            className="flex gap-1.5 overflow-x-auto px-0.5 pt-0.5"
            aria-label="Attached canvas items"
          >
            {activeAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex min-w-0 max-w-[220px] shrink-0 items-center gap-1.5 rounded-lg bg-[var(--studio-raised)] p-1 pr-1.5 shadow-[inset_0_0_0_1px_var(--line)]"
              >
                <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                  {attachment.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attachment.previewUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : attachment.kind === 'video' ? (
                    <Video className="size-3.5" />
                  ) : attachment.kind === 'text' ? (
                    <FileText className="size-3.5" />
                  ) : (
                    <ImageIcon className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold">
                  {attachment.title}
                </span>
                <button
                  type="button"
                  className="grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => removeAttachment(attachment.id)}
                  aria-label={`Remove ${attachment.title}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {selectedSkills.length ? (
          <div
            className="flex flex-wrap gap-1 px-0.5 pt-0.5"
            aria-label="Attached skills"
          >
            {selectedSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                className="flex max-w-full items-center gap-1 rounded-md bg-primary/9 px-1.5 py-1 text-[10.5px] font-semibold text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                title={skill.description}
                onClick={() => selectSkill(skill.id)}
                aria-label={`Remove ${skill.name}`}
              >
                <BookOpen className="size-3" />
                <span className="truncate">{skill.name}</span>
                <X className="size-2.5 opacity-70" />
              </button>
            ))}
          </div>
        ) : null}
        <Textarea
          ref={inputRef}
          value={input}
          rows={3}
          placeholder="Describe an idea… Type @ or / to attach a Skill"
          className="min-h-[72px] resize-none border-0 bg-transparent px-1 py-1 text-[13px] leading-5 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
          aria-autocomplete="list"
          aria-controls={
            activeMention && skillPickerOpen ? SKILL_LIST_ID : undefined
          }
          aria-expanded={Boolean(activeMention && skillPickerOpen)}
          aria-activedescendant={
            activeMention && skillPickerOpen && visibleSkills.length
              ? `${SKILL_LIST_ID}-${visibleSkills[activeSkillIndex]?.id ?? visibleSkills[0].id}`
              : undefined
          }
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (activeMention && handleSkillPickerKeyDown(event)) return;
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
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
                <DropdownMenuItem onSelect={() => onAddNode('image')}>
                  <ImageIcon /> Image generator
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onAddNode('video')}>
                  <Video /> Video generator
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onAddNode('text')}>
                  <FileText /> Text
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover
              open={skillPickerOpen}
              onOpenChange={(next) => {
                setSkillPickerOpen(next);
                if (next) setActiveSkillIndex(0);
                if (!next) setSkillQuery('');
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="rounded-lg bg-[var(--studio-raised)] px-2 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-[var(--studio-raised)]"
                  aria-label="Attach a Skill"
                >
                  <BookOpen /> Skills
                  {selectedSkillIds.length ? (
                    <span className="tabular-nums text-primary">
                      {selectedSkillIds.length}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                className="w-[326px] overflow-hidden p-0"
                onOpenAutoFocus={(event) => {
                  if (activeMention) event.preventDefault();
                }}
              >
                <div className="flex items-center gap-2 border-b px-2.5 py-2">
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    value={skillQuery}
                    onChange={(event) => {
                      setSkillQuery(event.target.value);
                      setActiveSkillIndex(0);
                    }}
                    placeholder="Search 12 built-in skills"
                    className="h-7 border-0 px-0 text-[12px] shadow-none focus-visible:ring-0"
                    aria-label="Search skills"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={skillPickerOpen}
                    aria-controls={SKILL_LIST_ID}
                    aria-activedescendant={
                      visibleSkills.length
                        ? `${SKILL_LIST_ID}-${visibleSkills[activeSkillIndex]?.id ?? visibleSkills[0].id}`
                        : undefined
                    }
                    onKeyDown={handleSkillPickerKeyDown}
                  />
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {selectedSkillIds.length}/{MAX_ACTIVE_STUDIO_SKILLS}
                  </span>
                </div>
                <div
                  id={SKILL_LIST_ID}
                  role="listbox"
                  aria-multiselectable="true"
                  aria-label="Built-in skills"
                  className="max-h-[276px] overflow-y-auto p-1.5"
                >
                  {visibleSkills.length ? (
                    visibleSkills.map((skill, index) => {
                      const selected = selectedSkillIds.includes(skill.id);
                      const disabled =
                        !selected &&
                        selectedSkillIds.length >= MAX_ACTIVE_STUDIO_SKILLS;
                      return (
                        <button
                          key={skill.id}
                          id={`${SKILL_LIST_ID}-${skill.id}`}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={disabled}
                          className={cn(
                            'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent disabled:opacity-40',
                            index === activeSkillIndex && 'bg-accent',
                          )}
                          onClick={() => selectSkill(skill.id)}
                          onMouseEnter={() => setActiveSkillIndex(index)}
                        >
                          <span
                            className={cn(
                              'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md',
                              selected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {selected ? (
                              <Check className="size-3" />
                            ) : (
                              <BookOpen className="size-3" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11.5px] font-semibold">
                              {skill.name}
                            </span>
                            <span className="mt-0.5 block text-[10.5px] leading-4 text-muted-foreground">
                              {skill.description}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-2 py-5 text-center text-[11px] text-muted-foreground">
                      No matching skills
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {busy ? (
            <Button
              type="button"
              size="icon-sm"
              className="rounded-lg"
              onClick={onStop}
              aria-label="Stop Agent"
            >
              <Square className="size-3 fill-current" />
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

export default memo(AgentPanel);
