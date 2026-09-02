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
  AlertCircle,
  AtSign,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  ImageIcon,
  LoaderCircle,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  Square,
  Video,
  X,
} from 'lucide-react';
import type { FileUIPart } from 'ai';
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
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import {
  AgentActivity,
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
import {
  attachmentsForStudioNodes,
  MAX_SELECTED_CANVAS_NODES,
  studioAgentMessageContext,
  type StudioAgentAttachment,
  type StudioAgentUIMessage,
} from '@/lib/studio/agent-context';
import { stripStudioAgentEmoji } from '@/lib/studio/agent-output';
import { modelOptionsForKind } from '@/lib/studio/model-catalog';
import type { StudioNode, StudioNodeKind } from '@/lib/studio/types';
import AgentMarkdown from './AgentMarkdown';
import {
  composerTriggerAtEnd,
  filterCanvasMentionNodes,
  isStudioWorkflowSettled,
  removeComposerTrigger,
  workflowProgress,
  workflowReceiptFromPart,
  workflowReceiptsFromMessages,
} from './AgentPanel.logic';

interface AgentPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  messages: StudioAgentUIMessage[];
  nodes: StudioNode[];
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
const CANVAS_MENTION_LIST_ID = 'studio-agent-canvas-mention-list';

function hasVisibleAssistantPart(message: StudioAgentUIMessage) {
  return message.parts.some(
    (part) =>
      ((part.type === 'text' || part.type === 'reasoning') &&
        Boolean(part.text)) ||
      part.type.startsWith('tool-'),
  );
}

function attachmentIcon(kind: StudioNodeKind) {
  return kind === 'video' ? (
    <Video className="size-3.5" />
  ) : kind === 'text' ? (
    <FileText className="size-3.5" />
  ) : (
    <ImageIcon className="size-3.5" />
  );
}

function UserMessageContext({ message }: { message: StudioAgentUIMessage }) {
  const context = studioAgentMessageContext(message);
  if (!context || (!context.attachments.length && !context.skills.length)) {
    return null;
  }
  return (
    <div className="mb-2 flex flex-col gap-1.5" aria-label="Message context">
      {context.attachments.length ? (
        <div className="grid gap-1.5">
          {context.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-background/55 p-1.5"
            >
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                {attachment.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachment.previewUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  attachmentIcon(attachment.kind)
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold">
                  {attachment.title}
                </span>
                <span className="block truncate text-[9.5px] text-muted-foreground">
                  {attachment.source === 'upload' ? 'Uploaded ' : 'Canvas '}
                  {attachment.kind}
                  {attachment.modelId ? ` · ${attachment.modelId}` : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {context.skills.length ? (
        <div className="flex flex-wrap gap-1" aria-label="Referenced skills">
          {context.skills.map((skill) => (
            <span
              key={skill.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/15 bg-primary/[0.06] px-1.5 py-1 text-[10px] font-semibold text-primary"
              title={skill.category}
            >
              <BookOpen className="size-2.5" />
              <span className="truncate">{skill.name}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessageFile({ part }: { part: FileUIPart }) {
  const image = part.mediaType.startsWith('image/');
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-background/55 p-1.5">
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={part.url} alt="" className="size-full object-cover" />
        ) : (
          <Paperclip className="size-3.5" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold">
        {part.filename || 'Attachment'}
      </span>
    </div>
  );
}

function AgentWorkflowCard({
  workflow,
  nodes,
}: {
  workflow: NonNullable<ReturnType<typeof workflowReceiptFromPart>>;
  nodes: StudioNode[];
}) {
  const progress = workflowProgress(workflow, nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const workflowTitle = stripStudioAgentEmoji(workflow.title);
  const percent = progress.total
    ? Math.round(((progress.ready + progress.errors) / progress.total) * 100)
    : 0;
  return (
    <section
      className="mt-1 overflow-hidden rounded-xl border border-border/80 bg-[var(--studio-raised)] shadow-[0_5px_16px_-14px_rgba(82,43,24,.42)]"
      aria-label={`Workflow: ${workflowTitle}`}
    >
      <div className="flex items-center gap-2 border-b border-border/75 px-2.5 py-2">
        {progress.complete ? (
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
        ) : progress.errors ? (
          <AlertCircle className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" />
        )}
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">
          {workflowTitle}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {progress.ready}/{progress.total}
        </span>
      </div>
      <div className="h-px bg-border/45">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="grid gap-px bg-border/55">
        {workflow.nodes.map((receipt) => {
          const node = byId.get(receipt.id);
          const status = node?.data.status ?? 'idle';
          const model = modelOptionsForKind(receipt.kind).find(
            (option) => option.id === receipt.modelId,
          );
          return (
            <div
              key={receipt.id}
              className="flex min-w-0 items-center gap-2 bg-card px-2.5 py-2"
            >
              {status === 'ready' ? (
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
              ) : status === 'error' ? (
                <AlertCircle className="size-3.5 shrink-0 text-destructive" />
              ) : status === 'generating' || status === 'uploading' ? (
                <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" />
              ) : (
                <Circle className="size-3.5 shrink-0 text-muted-foreground/65" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10.5px] font-semibold">
                  {stripStudioAgentEmoji(receipt.title)}
                </span>
                <span className="block truncate text-[9.5px] text-muted-foreground">
                  {model?.label || receipt.modelId}
                  {status === 'idle' && receipt.dependsOn.length
                    ? ' · Waiting for dependencies'
                    : ` · ${status}`}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function toolLabel(type: string) {
  if (type.includes('readSkillResource')) return 'Read Skill';
  if (type.includes('createCanvasWorkflow')) return 'Run creative workflow';
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
  nodes,
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
  const [canvasPickerOpen, setCanvasPickerOpen] = useState(false);
  const [canvasQuery, setCanvasQuery] = useState('');
  const [activeCanvasIndex, setActiveCanvasIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
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
  const composerTrigger = composerTriggerAtEnd(input);
  const canvasTrigger =
    composerTrigger?.kind === 'canvas' ? composerTrigger : undefined;
  const skillTrigger =
    composerTrigger?.kind === 'skill' ? composerTrigger : undefined;
  const selectedSkills = selectedSkillIds.map(studioSkillById);
  const normalizedSkillQuery = skillQuery.trim().toLowerCase();
  const visibleSkills = BUILT_IN_STUDIO_SKILLS.filter((skill) =>
    `${skill.name} ${skill.description} ${skill.category}`
      .toLowerCase()
      .includes(normalizedSkillQuery),
  );
  const visibleCanvasNodes = filterCanvasMentionNodes(
    nodes,
    canvasQuery,
    activeAttachments.map((attachment) => attachment.id),
  ).slice(0, 12);
  const canSend = input.trim().length > 0 && !busy;
  const lastMessageId = messages[messages.length - 1]?.id;
  const activeWorkflowCount = workflowReceiptsFromMessages(messages).filter(
    (workflow) => !isStudioWorkflowSettled(workflow, nodes),
  ).length;

  const setInput = (value: string) => {
    setInputState({
      draftId: activeDraftId,
      value,
      attachments: activeAttachments,
    });
    const trigger = composerTriggerAtEnd(value);
    if (trigger?.kind === 'canvas') {
      setCanvasQuery(trigger.query);
      setActiveCanvasIndex(0);
      setCanvasPickerOpen(true);
      setSkillPickerOpen(false);
      setSkillQuery('');
    } else if (trigger?.kind === 'skill') {
      setSkillQuery(trigger.query);
      setActiveSkillIndex(0);
      setSkillPickerOpen(true);
      setCanvasPickerOpen(false);
      setCanvasQuery('');
    } else {
      if (skillPickerOpen) {
        setSkillPickerOpen(false);
        setSkillQuery('');
      }
      if (canvasPickerOpen) {
        setCanvasPickerOpen(false);
        setCanvasQuery('');
      }
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
    if (!canvasPickerOpen || !visibleCanvasNodes.length) return;
    document
      .getElementById(
        `${CANVAS_MENTION_LIST_ID}-${activeCanvasIndex}`,
      )
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeCanvasIndex, canvasPickerOpen, visibleCanvasNodes]);

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
    setCanvasPickerOpen(false);
    setCanvasQuery('');
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
    if (skillTrigger) {
      const next = removeComposerTrigger(input, skillTrigger);
      setInput(next);
      setSkillPickerOpen(false);
      setSkillQuery('');
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function selectCanvasNode(node: StudioNode) {
    const [attachment] = attachmentsForStudioNodes(nodes, [node.id]);
    if (!attachment) return;
    const nextAttachments = activeAttachments.some(
      (current) => current.id === attachment.id,
    )
      ? activeAttachments
      : [...activeAttachments, attachment].slice(0, MAX_SELECTED_CANVAS_NODES);
    setInputState({
      draftId: activeDraftId,
      value: canvasTrigger
        ? removeComposerTrigger(input, canvasTrigger)
        : input,
      attachments: nextAttachments,
    });
    setCanvasPickerOpen(false);
    setCanvasQuery('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
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

  function handleCanvasPickerKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
  ) {
    if (!canvasPickerOpen) return false;
    if (event.key === 'Escape') {
      event.preventDefault();
      setCanvasPickerOpen(false);
      setCanvasQuery('');
      return true;
    }
    if (!visibleCanvasNodes.length) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveCanvasIndex(
        (current) =>
          (current + direction + visibleCanvasNodes.length) %
          visibleCanvasNodes.length,
      );
      return true;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      selectCanvasNode(
        visibleCanvasNodes[activeCanvasIndex] ?? visibleCanvasNodes[0],
      );
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
            {activeWorkflowCount ? (
              <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-primary">
                <LoaderCircle className="size-3 animate-spin" />
                {activeWorkflowCount === 1
                  ? 'Run active'
                  : `${activeWorkflowCount} runs active`}
              </span>
            ) : null}
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
                    ? 'ml-auto max-w-[94%] rounded-[14px] bg-[var(--studio-composer)] px-3 py-2.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_78%,transparent)]'
                    : 'flex max-w-full flex-col gap-1.5'
                }
              >
                {message.role === 'assistant' ? (
                  <span className="text-[11px] font-bold text-muted-foreground">
                    Agent
                  </span>
                ) : null}
                {message.role === 'user' ? (
                  <UserMessageContext message={message} />
                ) : null}
                {message.parts.map((part, index) => {
                  if (part.type === 'text' && part.text) {
                    return (
                      <AgentMarkdown
                        key={`${message.id}-t-${index}`}
                        compact={message.role === 'user'}
                      >
                        {message.role === 'assistant'
                          ? stripStudioAgentEmoji(part.text)
                          : part.text}
                      </AgentMarkdown>
                    );
                  }
                  if (part.type === 'file') {
                    const alreadyShown = studioAgentMessageContext(
                      message,
                    )?.attachments.some(
                      (attachment) => attachment.previewUrl === part.url,
                    );
                    if (alreadyShown) return null;
                    return (
                      <MessageFile
                        key={`${message.id}-f-${index}`}
                        part={part}
                      />
                    );
                  }
                  if (part.type === 'reasoning' && part.text) {
                    return (
                      <AgentThinking
                        key={`${message.id}-r-${index}`}
                        label="Thinking"
                        active={busy && message.id === lastMessageId}
                      >
                        <AgentMarkdown compact>
                          {stripStudioAgentEmoji(part.text)}
                        </AgentMarkdown>
                      </AgentThinking>
                    );
                  }
                  if (part.type.startsWith('tool-')) {
                    const workflow = workflowReceiptFromPart(part);
                    if (workflow) {
                      return (
                        <AgentWorkflowCard
                          key={`${message.id}-workflow-${index}`}
                          workflow={workflow}
                          nodes={nodes}
                        />
                      );
                    }
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
                {message.role === 'assistant' &&
                !hasVisibleAssistantPart(message) &&
                busy ? (
                  <AgentThinking label="Thinking" />
                ) : null}
              </motion.article>
            ))}
            {status === 'submitted' ? (
              <AgentThinking label="Planning the next step" />
            ) : null}
            {error ? (
              <p className="rounded-xl border border-destructive/20 bg-destructive/[0.06] px-2.5 py-2 text-[12.5px] font-semibold text-destructive">
                {stripStudioAgentEmoji(
                  error.message || 'Generation stopped. Try again.',
                )}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <form
        ref={composerRef}
        className="mx-3 mb-3 flex flex-col gap-1.5 rounded-[14px] bg-[var(--studio-composer)] p-2 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_82%,transparent)]"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Popover
          open={canvasPickerOpen}
          onOpenChange={(next) => {
            setCanvasPickerOpen(next);
            setActiveCanvasIndex(0);
            if (next) {
              setSkillPickerOpen(false);
              setSkillQuery('');
            } else {
              setCanvasQuery('');
            }
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
        <PopoverAnchor>
        <Textarea
          ref={inputRef}
          value={input}
          rows={3}
          placeholder="Describe an idea… @ canvas items · / Skills"
          className="min-h-[72px] resize-none border-0 bg-transparent px-1 py-1 text-[13px] leading-5 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
          aria-autocomplete="list"
          aria-controls={
            canvasPickerOpen
              ? CANVAS_MENTION_LIST_ID
              : skillPickerOpen
                ? SKILL_LIST_ID
                : undefined
          }
          aria-expanded={Boolean(
            canvasPickerOpen || skillPickerOpen,
          )}
          aria-activedescendant={
            canvasPickerOpen && visibleCanvasNodes.length
              ? `${CANVAS_MENTION_LIST_ID}-${activeCanvasIndex}`
              : skillPickerOpen && visibleSkills.length
              ? `${SKILL_LIST_ID}-${visibleSkills[activeSkillIndex]?.id ?? visibleSkills[0].id}`
              : undefined
          }
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (canvasPickerOpen && handleCanvasPickerKeyDown(event)) return;
            if (skillPickerOpen && handleSkillPickerKeyDown(event)) return;
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={10}
          className="w-(--radix-popover-trigger-width) min-w-[264px] overflow-hidden p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // Typing keeps filtering the list, so focus and clicks that stay
          // inside the composer must not dismiss the menu.
          onInteractOutside={(event) => {
            if (composerRef.current?.contains(event.target as Node)) {
              event.preventDefault();
            }
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b px-2.5 py-2">
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold">
              <AtSign className="size-3.5 shrink-0 text-primary" />
              Reference canvas
            </span>
            <span className="truncate text-[10px] text-muted-foreground">
              {canvasQuery ? `Matching “${canvasQuery}”` : 'Type to filter'}
            </span>
          </div>
          <div
            id={CANVAS_MENTION_LIST_ID}
            role="listbox"
            aria-label="Canvas items"
            className="max-h-[238px] overflow-y-auto p-1.5"
          >
            {visibleCanvasNodes.length ? (
              visibleCanvasNodes.map((node, index) => {
                const previewUrl =
                  node.type === 'video'
                    ? node.data.posterSrc
                    : node.type === 'image'
                      ? node.data.src
                      : undefined;
                return (
                  <button
                    key={node.id}
                    id={`${CANVAS_MENTION_LIST_ID}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeCanvasIndex}
                    className={cn(
                      'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent',
                      index === activeCanvasIndex && 'bg-accent',
                    )}
                    onClick={() => selectCanvasNode(node)}
                    onMouseEnter={() => setActiveCanvasIndex(index)}
                  >
                    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                      {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        attachmentIcon(node.type)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-semibold">
                        {node.data.title || node.type}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {node.type} · {node.data.status}
                        {node.data.modelId ? ` · ${node.data.modelId}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-5 text-center text-[11px] text-muted-foreground">
                {nodes.length
                  ? 'No matching unattached canvas items'
                  : 'The canvas is empty'}
              </p>
            )}
          </div>
        </PopoverContent>
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
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn(
                'rounded-lg bg-[var(--studio-raised)] shadow-[inset_0_0_0_1px_var(--line)] hover:bg-[var(--studio-raised)]',
                canvasPickerOpen && 'text-primary',
              )}
              aria-label="Reference a canvas item"
              aria-expanded={canvasPickerOpen}
              onClick={() => {
                if (canvasPickerOpen) {
                  setCanvasPickerOpen(false);
                  setCanvasQuery('');
                  return;
                }
                // Opening from the button seeds the same '@' the keyboard
                // path uses, so typing keeps filtering the list.
                setInput(/\s$|^$/.test(input) ? `${input}@` : `${input} @`);
                window.requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              <AtSign />
            </Button>
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
                  if (skillTrigger) event.preventDefault();
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
        </Popover>
      </form>
    </motion.aside>
  );
}

function sameAgentPanelNodes(left: StudioNode[], right: StudioNode[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((node, index) => {
    const other = right[index];
    return Boolean(
      other &&
        node.id === other.id &&
        node.type === other.type &&
        node.data === other.data,
    );
  });
}

export default memo(
  AgentPanel,
  (previous, next) =>
    previous.open === next.open &&
    previous.title === next.title &&
    previous.messages === next.messages &&
    previous.status === next.status &&
    previous.error === next.error &&
    previous.onClose === next.onClose &&
    previous.onSend === next.onSend &&
    previous.onStop === next.onStop &&
    previous.onAddNode === next.onAddNode &&
    previous.draftRequest === next.draftRequest &&
    sameAgentPanelNodes(previous.nodes, next.nodes),
);
