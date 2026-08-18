'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  AtSign,
  FolderLock,
  ImagePlus,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  createStudioProjectSynced,
  deleteStudioProjectSynced,
  listStudioProjectsSynced,
  renameStudioProjectSynced,
} from '@/lib/studio/client-store';
import { formatStudioDate } from '@/lib/studio/store';
import type { StudioProject } from '@/lib/studio/types';
import {
  studioItem,
  studioSnap,
  studioStagger,
  studioTween,
} from '@/lib/studio/motion';
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
import { MotionTabs } from '@/app/components/ui/motion-tabs';
import { cn } from '@/lib/utils';

const MODES = [
  { value: 'agent', label: 'Plan with Agent', icon: Sparkles },
  { value: 'inspire', label: 'Find references', icon: Search },
  { value: 'design', label: 'Freeform', icon: Wand2 },
] as const;

export default function StudioHome({
  authenticated = false,
}: {
  authenticated?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] =
    useState<(typeof MODES)[number]['value']>('agent');
  const [listening, setListening] = useState(false);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(authenticated);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const reduceMotion = Boolean(useReducedMotion());

  const refreshProjects = useCallback(async () => {
    if (!authenticated) {
      setProjects([]);
      setProjectsLoading(false);
      return;
    }
    try {
      setProjects(await listStudioProjectsSynced());
    } finally {
      setProjectsLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshProjects(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshProjects]);

  const canSubmit = prompt.trim().length > 0;

  function requireAccount() {
    if (authenticated) return true;
    router.push('/login?next=/studio');
    return false;
  }

  function openProject(id: string) {
    router.push(`/studio/${id}`);
  }

  async function createFromPrompt() {
    const text = prompt.trim();
    if (!text || !requireAccount()) return;
    const prefix =
      mode === 'inspire'
        ? 'Find strong visual references before creating: '
        : mode === 'design'
          ? 'Explore this as a freeform creative direction: '
          : 'Plan the task and canvas structure before executing: ';
    const project = await createStudioProjectSynced({
      title: text.slice(0, 18),
      pendingPrompt: `${prefix}${text}`,
    });
    router.push(`/studio/${project.id}`);
  }

  async function createBlank() {
    if (!requireAccount()) return;
    const project = await createStudioProjectSynced({
      title: 'Untitled project',
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
    recognition.lang = 'en-US';
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
    <motion.main
      className="creator-studio-home relative min-h-full overflow-hidden"
      initial={reduceMotion ? false : 'hidden'}
      animate="show"
      variants={studioStagger}
    >
      <div className="creator-studio-glow" aria-hidden />
      <div className="relative mx-auto w-full max-w-[1160px] px-8 pb-20 pt-12 max-md:px-4 max-md:pt-8">
        <motion.header
          className="mb-7 flex items-end justify-between gap-8 max-md:items-start"
          variants={studioItem}
        >
          <div className="max-w-[700px]">
            <p className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Snackd / Creator Studio
            </p>
            <p className="max-w-[620px] text-[15px] leading-7 text-muted-foreground">
              Describe what you want to make. The Agent can collect references,
              organize the work, and place images, video, and text on one canvas.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 rounded-xl bg-card px-4 shadow-none max-md:hidden"
            onClick={() => void createBlank()}
          >
            <Plus />
            Blank canvas
          </Button>
        </motion.header>

        <motion.form
          variants={studioItem}
          className="creator-studio-composer rounded-[22px] border bg-card/95 p-2.5 shadow-[0_22px_60px_-42px_rgba(0,0,0,.42)]"
          onSubmit={(event) => {
            event.preventDefault();
            void createFromPrompt();
          }}
        >
          <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-2">
            <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              <span className="size-1.5 rounded-full bg-primary" />
              New canvas
            </span>
            <span className="text-xs text-muted-foreground max-sm:hidden">
              Enter to create · Shift + Enter for a new line
            </span>
          </div>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void createFromPrompt();
              }
            }}
            placeholder="Describe what you want to research, plan, or create…"
            rows={3}
            className="min-h-[112px] resize-none border-0 bg-transparent px-3 py-4 text-[19px] leading-8 shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-1 pb-1 pt-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl"
                aria-label="Upload reference image"
                onClick={() => {
                  if (requireAccount()) fileRef.current?.click();
                }}
              >
                <Upload />
              </Button>
              <MotionTabs
                value={mode}
                items={MODES}
                ariaLabel="Creation mode"
                onValueChange={setMode}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl max-sm:hidden"
                aria-label="Mention an item"
                onClick={() => setPrompt((current) => `${current}@`)}
              >
                <AtSign />
              </Button>
              <motion.div
                animate={listening ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={
                  listening
                    ? { repeat: Infinity, duration: 1.1, ease: 'easeInOut' }
                    : studioTween
                }
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'rounded-xl max-sm:hidden',
                    listening && 'bg-secondary text-foreground',
                  )}
                  aria-label="Voice input"
                  onClick={startVoice}
                >
                  <Mic />
                </Button>
              </motion.div>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-10 rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90"
              >
                Create
                <ArrowRight />
              </Button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file || !requireAccount()) return;
              const project = await createStudioProjectSynced({
                title: file.name.replace(/\.[^.]+$/, '') || 'Reference study',
                pendingPrompt:
                  prompt.trim() || `Create from this reference image: ${file.name}`,
              });
              router.push(`/studio/${project.id}`);
            }}
          />
        </motion.form>

        <motion.section className="mt-12" variants={studioItem}>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em]">
                Recent projects
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {authenticated
                  ? 'Continue where you left off. Changes are saved automatically.'
                  : 'Projects stay private to the signed-in account.'}
              </p>
            </div>
            {authenticated && projects.length ? (
              <span className="text-xs font-semibold text-muted-foreground">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </span>
            ) : null}
          </div>

          {!authenticated ? (
            <div className="flex min-h-[190px] items-center justify-between gap-8 rounded-[22px] border bg-secondary/55 px-8 py-7 max-sm:flex-col max-sm:items-start max-sm:px-6">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card shadow-sm">
                  <FolderLock className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold">
                    Sign in to view your projects
                  </h3>
                  <p className="mt-1.5 max-w-lg text-sm leading-6 text-muted-foreground">
                    Guest sessions do not load local or account data. Your cloud
                    projects appear after you sign in.
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="h-10 shrink-0 rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90"
              >
                <Link href="/login?next=/studio">
                  Sign in
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          ) : projectsLoading ? (
            <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-[230px] animate-pulse rounded-[20px] bg-secondary"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <motion.button
                type="button"
                className="group flex min-h-[230px] flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed bg-card/55 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                whileHover={reduceMotion ? undefined : { y: -3 }}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                transition={studioSnap}
                onClick={() => void createBlank()}
              >
                <span className="grid size-11 place-items-center rounded-full border bg-card text-foreground shadow-sm">
                  <Plus className="size-[18px]" />
                </span>
                <span className="text-sm font-semibold">New blank canvas</span>
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
                    <span
                      className={cn(
                        'grid h-[174px] gap-0.5 overflow-hidden rounded-[20px] border bg-muted shadow-sm',
                        project.coverUrls.length > 1
                          ? 'grid-cols-2'
                          : 'grid-cols-1',
                      )}
                    >
                      {project.coverUrls.length ? (
                        project.coverUrls.slice(0, 4).map((src) => (
                          <i
                            key={src}
                            className="min-h-0 min-w-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${src})` }}
                          />
                        ))
                      ) : (
                        <span className="grid place-items-center text-muted-foreground">
                          <ImagePlus className="size-5" />
                        </span>
                      )}
                    </span>
                    <span className="flex flex-col gap-0.5 px-1 pt-3 pr-10">
                      <b className="overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap">
                        {project.title}
                      </b>
                      <small className="text-xs font-medium text-muted-foreground">
                        Updated {formatStudioDate(project.updatedAt)}
                      </small>
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        className="absolute top-2 right-2 rounded-xl opacity-100 shadow-sm md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                        aria-label={`More actions for ${project.title}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DropdownMenuItem
                        onSelect={() => {
                          setRenameId(project.id);
                          setRenameTitle(project.title);
                        }}
                      >
                        <Pencil /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleteId(project.id)}
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      <Dialog
        open={Boolean(renameId)}
        onOpenChange={(open) => !open && setRenameId(null)}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameId(null)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitRename()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Every node on the canvas will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void submitDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.main>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  interface SpeechRecognitionEvent extends Event {
    results: {
      [index: number]: {
        [index: number]: {
          transcript: string;
        };
      };
    };
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    start(): void;
  }
}
