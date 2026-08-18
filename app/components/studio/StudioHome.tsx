'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUp,
  AtSign,
  ImagePlus,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react';
import { STUDIO_TEMPLATES } from '@/lib/studio/templates';
import {
  createStudioProjectSynced,
  deleteStudioProjectSynced,
  listStudioProjectsSynced,
  renameStudioProjectSynced,
} from '@/lib/studio/client-store';
import { formatStudioDate } from '@/lib/studio/store';
import type { StudioProject } from '@/lib/studio/types';
import { studioChipSpring, studioItem, studioSnap, studioStagger, studioTween } from '@/lib/studio/motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/lib/utils';

const CHIPS = [
  { id: 'agent', label: 'Agent 模式', icon: Sparkles },
  { id: 'auto', label: '自动', icon: Zap },
  { id: 'inspire', label: '灵感搜索', icon: Search },
  { id: 'design', label: '创意设计', icon: Wand2 },
] as const;

export default function StudioHome() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [chip, setChip] = useState<string>('agent');
  const [listening, setListening] = useState(false);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const reduceMotion = Boolean(useReducedMotion());

  async function refreshProjects() {
    setProjects(await listStudioProjectsSynced());
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshProjects(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const canSubmit = prompt.trim().length > 0;

  function openProject(id: string) {
    router.push(`/studio/${id}`);
  }

  async function createFromPrompt() {
    const text = prompt.trim();
    if (!text) return;
    const prefix =
      chip === 'inspire' ? '先搜索视觉参考，再开始创作：' : chip === 'design' ? '按创意设计方向推进：' : '';
    const project = await createStudioProjectSynced({
      title: text.slice(0, 18),
      pendingPrompt: `${prefix}${text}`,
    });
    router.push(`/studio/${project.id}`);
  }

  async function createFromTemplate(templateId: string) {
    const project = await createStudioProjectSynced({ templateId });
    router.push(`/studio/${project.id}`);
  }

  async function createBlank() {
    const project = await createStudioProjectSynced({
      title: '未命名项目',
      blank: true,
    });
    router.push(`/studio/${project.id}`);
  }

  async function submitRename() {
    if (!renameId) return;
    await renameStudioProjectSynced(renameId, renameTitle);
    setRenameId(null);
    await refreshProjects();
  }

  async function submitDelete() {
    if (!deleteId) return;
    await deleteStudioProjectSynced(deleteId);
    setDeleteId(null);
    await refreshProjects();
  }

  function startVoice() {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const said = event.results[0]?.[0]?.transcript || '';
      if (said) setPrompt((current) => (current ? `${current} ${said}` : said));
    };
    recognition.start();
  }

  return (
    <motion.div
      className="min-w-0 px-8 pb-20 pt-10 max-md:px-4 max-md:pb-20 max-md:pt-7"
      initial={reduceMotion ? false : 'hidden'}
      animate="show"
      variants={studioStagger}
    >
      <motion.section
        className="mb-14 flex w-full min-w-0 flex-col items-center"
        variants={studioStagger}
      >
        <motion.p
          variants={studioItem}
          className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
        >
          CreatorStudio
        </motion.p>
        <motion.h1
          variants={studioItem}
          className="mb-7 w-full max-w-[720px] text-center font-serif text-[clamp(28px,8vw,40px)] font-semibold leading-[1.16] tracking-[-0.028em] wrap-break-word text-balance"
        >
          今天想在无限画布创作什么？
        </motion.h1>

        <motion.form
          variants={studioItem}
          className="w-full max-w-[720px] rounded-[28px] bg-secondary/65 p-1.5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--field)_70%,transparent)]"
          onSubmit={(event) => {
            event.preventDefault();
            void createFromPrompt();
          }}
        >
          <Card className="gap-0 rounded-[22px] border-0 px-[18px] py-[18px] max-md:px-4">
            <div className="flex items-start gap-3.5">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-12 shrink-0 rounded-2xl bg-[var(--input)]"
                aria-label="上传参考图"
                onClick={() => fileRef.current?.click()}
              >
                <Plus />
              </Button>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void createFromPrompt();
                  }
                }}
                placeholder="描述画面、镜头或品牌，也可以上传参考图"
                rows={3}
                className="min-h-[72px] resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <LayoutGroup id="studio-home-chips">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  {CHIPS.map(({ id, label, icon: Icon }) => (
                    <Button
                      key={id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="relative"
                      onClick={() => setChip(id)}
                    >
                      {chip === id ? (
                        <motion.span
                          layoutId={reduceMotion ? undefined : 'studio-home-chip'}
                          className="absolute inset-0 rounded-full bg-accent"
                          transition={studioChipSpring}
                        />
                      ) : null}
                      <Icon className={cn('relative z-[1]', chip === id && 'text-accent-foreground')} />
                      <span className={cn('relative z-[1]', chip === id && 'text-accent-foreground')}>{label}</span>
                    </Button>
                  ))}
                </div>
              </LayoutGroup>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="插入主体"
                  onClick={() => setPrompt((current) => `${current}@`)}
                >
                  <AtSign />
                </Button>
                <motion.div
                  animate={listening ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={listening ? { repeat: Infinity, duration: 1.1, ease: 'easeInOut' } : studioTween}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(listening && 'bg-secondary text-foreground')}
                    aria-label="语音输入"
                    onClick={startVoice}
                  >
                    <Mic />
                  </Button>
                </motion.div>
                <motion.div animate={{ scale: canSubmit ? 1 : 0.94 }} transition={studioSnap}>
                  <Button type="submit" size="icon" disabled={!canSubmit} aria-label="创建项目">
                    <ArrowUp />
                  </Button>
                </motion.div>
              </div>
            </div>
          </Card>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              const project = await createStudioProjectSynced({
                title: file.name.replace(/\.[^.]+$/, '') || '参考创作',
                pendingPrompt: prompt.trim() || `以这张参考图继续创作：${file.name}`,
              });
              router.push(`/studio/${project.id}`);
            }}
          />
        </motion.form>
      </motion.section>

      <motion.section variants={studioItem}>
        <h2 className="mb-3.5 px-0.5 text-[13px] font-semibold tracking-wide text-muted-foreground">快速开始</h2>
        <div className="grid auto-cols-[minmax(196px,1fr)] grid-flow-col gap-3.5 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STUDIO_TEMPLATES.map((template) => (
            <motion.button
              key={template.id}
              type="button"
              className="group snap-start flex flex-col gap-2.5 border-0 bg-transparent p-0 text-left text-inherit"
              whileHover={reduceMotion ? undefined : { y: -3 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
              transition={studioSnap}
              onClick={() => void createFromTemplate(template.id)}
            >
              <Card className="gap-0 overflow-hidden rounded-[18px] border-0 py-0 shadow-sm">
                <motion.span
                  className="block h-[138px] bg-cover bg-center"
                  style={{ backgroundImage: `url(${template.cover})` }}
                  whileHover={reduceMotion ? undefined : { scale: 1.035 }}
                  transition={studioSnap}
                />
              </Card>
              <span className="px-0.5 text-[13px] font-semibold leading-snug">{template.title}</span>
            </motion.button>
          ))}
        </div>
      </motion.section>

      <motion.section className="mt-10" variants={studioItem}>
        <h2 className="mb-3.5 px-0.5 text-[13px] font-semibold tracking-wide text-muted-foreground">最近项目</h2>
        <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-2 max-md:grid-cols-1">
          <motion.button
            type="button"
            className="group flex min-h-44 flex-col items-center justify-center gap-3 rounded-[20px] bg-secondary/55 text-muted-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--line)_80%,transparent)] hover:bg-accent hover:text-accent-foreground"
            whileHover={reduceMotion ? undefined : { y: -3 }}
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            transition={studioSnap}
            onClick={() => void createBlank()}
          >
            <span className="grid size-10 place-items-center rounded-full bg-card text-foreground shadow-[0_8px_20px_-16px_color-mix(in_srgb,var(--ink)_50%,transparent)]">
              <Plus className="size-[18px]" />
            </span>
            <span className="text-[13px] font-semibold">新建空白画布</span>
          </motion.button>
          {projects.map((project) => (
            <motion.div
              key={project.id}
              className="group relative min-w-0"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              transition={studioSnap}
            >
              <button
                type="button"
                className="flex w-full min-w-0 flex-col border-0 bg-transparent p-0 text-left text-inherit"
                onClick={() => openProject(project.id)}
              >
                <Card
                  className={cn(
                    'grid h-44 gap-0 overflow-hidden rounded-[20px] border-0 py-0 shadow-sm',
                    project.coverUrls.length > 1 ? 'grid-cols-2 gap-0.5' : 'grid-cols-1',
                  )}
                >
                  {project.coverUrls.length ? (
                    project.coverUrls.slice(0, 4).map((src) => (
                      <i key={src} className="min-h-0 min-w-0 bg-cover bg-center" style={{ backgroundImage: `url(${src})` }} />
                    ))
                  ) : (
                    <span className="grid place-items-center bg-muted text-muted-foreground">
                      <ImagePlus className="size-5" />
                    </span>
                  )}
                </Card>
                <span className="flex flex-col gap-0.5 px-1 pt-3 pr-10">
                  <b className="overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap">{project.title}</b>
                  <small className="text-xs font-medium text-muted-foreground">{formatStudioDate(project.updatedAt)}</small>
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-2 right-2 opacity-100 shadow-sm md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    aria-label={`${project.title} 更多操作`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenuItem
                    onSelect={() => {
                      setRenameId(project.id);
                      setRenameTitle(project.title);
                    }}
                  >
                    <Pencil /> 重命名
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteId(project.id)}>
                    <Trash2 /> 删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <Dialog open={Boolean(renameId)} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            autoFocus
            onChange={(event) => setRenameTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submitRename();
              }
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameId(null)}>
              取消
            </Button>
            <Button type="button" onClick={() => void submitRename()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个项目？</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复，画布上的节点也会一起清掉。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void submitDelete()}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    start: () => void;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
  }
  interface SpeechRecognitionEvent extends Event {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }
}
