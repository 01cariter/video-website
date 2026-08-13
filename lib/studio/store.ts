import type { Edge, Viewport } from '@xyflow/react';
import type { UIMessage } from 'ai';
import { STUDIO_TEMPLATES } from './templates';
import { sizeForAspect } from './geometry';
import { modelForKind } from './model-catalog';
import type { StudioNode, StudioNodeData, StudioNodeKind, StudioProject } from './types';
import { STUDIO_STORAGE_KEY, STUDIO_STORE_VERSION } from './types';

interface StudioStoreFile {
  version: number;
  projects: StudioProject[];
}

const DEFAULT_VIEWPORT: Viewport = { x: 72, y: 64, zoom: 1 };

function nowIso() {
  return new Date().toISOString();
}

export function createStudioId(prefix = 'p') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function emptyStore(): StudioStoreFile {
  return { version: STUDIO_STORE_VERSION, projects: [] };
}

function readStore(): StudioStoreFile {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(STUDIO_STORAGE_KEY);
    if (!raw) return seedStore();
    const parsed = JSON.parse(raw) as StudioStoreFile;
    if (!parsed || !Array.isArray(parsed.projects)) return seedStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(file: StudioStoreFile) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(file));
  } catch {
    const slim: StudioStoreFile = {
      ...file,
      projects: file.projects.map((project) => ({
        ...project,
        nodes: project.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            src: node.data.src && node.data.src.startsWith('data:') ? undefined : node.data.src,
          },
        })),
      })),
    };
    try {
      window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(slim));
    } catch {
      // Quota exhausted; keep working in memory for this session.
    }
  }
}

function demoImageNode(
  id: string,
  title: string,
  prompt: string,
  src: string,
  x: number,
  y: number,
): StudioNode {
  return {
    id,
    type: 'image',
    position: { x, y },
    data: {
      kind: 'image',
      title,
      prompt,
      status: 'ready',
      aspect: '1:1',
      src,
    },
    style: { width: 260, height: 260 },
  };
}

function seedStore(): StudioStoreFile {
  const created = nowIso();
  const file: StudioStoreFile = {
    version: STUDIO_STORE_VERSION,
    projects: [
      {
        id: 'demo-sky',
        title: '未命名项目',
        createdAt: created,
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        coverUrls: ['/studio/sky-1.jpg', '/studio/sky-2.jpg', '/studio/sky-3.jpg', '/studio/sky-4.jpg'],
        nodes: [
          demoImageNode('n1', '星野 01', '银河越过松岭', '/studio/sky-1.jpg', 40, 40),
          demoImageNode('n2', '星野 02', '湖面倒映银河', '/studio/sky-2.jpg', 340, 40),
          demoImageNode('n3', '星野 03', '雪山长曝光', '/studio/sky-3.jpg', 40, 340),
          demoImageNode('n4', '星野 04', '极光与湖面', '/studio/sky-4.jpg', 340, 340),
        ],
        edges: [],
        viewport: DEFAULT_VIEWPORT,
        messages: [],
        agentOpen: true,
      },
      {
        id: 'demo-qinglan',
        title: '青岚品牌包装图生成',
        createdAt: created,
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 52).toISOString(),
        coverUrls: ['/studio/pack-1.jpg', '/studio/pack-3.jpg', '/studio/pack-4.jpg', '/studio/pack-2.jpg'],
        nodes: [
          demoImageNode('n1', '礼盒组合', STUDIO_TEMPLATES[0].prompt, '/studio/pack-1.jpg', 40, 40),
          demoImageNode('n2', '主视觉', '青岚圆月松兰主视觉', '/studio/pack-3.jpg', 340, 40),
          demoImageNode('n3', '海报延展', '香水杂志叠层海报', '/studio/pack-4.jpg', 40, 340),
          demoImageNode('n4', '香氛烛', '青岚香氛烛特写', '/studio/pack-2.jpg', 340, 340),
        ],
        edges: [],
        viewport: DEFAULT_VIEWPORT,
        messages: [],
        agentOpen: true,
      },
    ],
  };
  writeStore(file);
  return file;
}

export function listStudioProjects(): StudioProject[] {
  return [...readStore().projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function getStudioProject(id: string): StudioProject | null {
  return readStore().projects.find((project) => project.id === id) ?? null;
}

export function saveStudioProject(next: StudioProject): StudioProject {
  const file = readStore();
  const covers = next.coverUrls.length
    ? next.coverUrls
    : next.nodes
        .map((node) => node.data.src)
        .filter((src): src is string => Boolean(src))
        .slice(0, 4);
  const project: StudioProject = {
    ...next,
    coverUrls: covers,
    updatedAt: nowIso(),
  };
  const index = file.projects.findIndex((item) => item.id === project.id);
  if (index >= 0) file.projects[index] = project;
  else file.projects.unshift(project);
  writeStore(file);
  return project;
}

export function deleteStudioProject(id: string) {
  const file = readStore();
  file.projects = file.projects.filter((project) => project.id !== id);
  writeStore(file);
}

export function renameStudioProject(id: string, title: string) {
  const current = getStudioProject(id);
  if (!current) return null;
  const next = title.trim() || '未命名项目';
  return saveStudioProject({ ...current, title: next });
}

export function createBlankNode(
  kind: StudioNodeKind,
  position: { x: number; y: number },
  extras: Partial<StudioNodeData> = {},
): StudioNode {
  const titles: Record<StudioNodeKind, string> = {
    image: '图片生成',
    video: '视频生成',
    text: '文本',
  };
  const defaults = modelForKind(kind).defaults;
  const aspect = String(extras.aspect || defaults.aspect || (kind === 'video' ? '16:9' : '1:1'));
  const size = sizeForAspect(aspect, kind);
  return {
    id: createStudioId('n'),
    type: kind,
    position,
    data: {
      kind,
      title: extras.title || titles[kind],
      prompt: extras.prompt || '',
      text: extras.text || '',
      status: extras.status || (extras.src || extras.text ? 'ready' : 'idle'),
      aspect,
      n: extras.n ?? (typeof defaults.n === 'number' ? defaults.n : 1),
      duration: extras.duration ?? (typeof defaults.duration === 'number' ? defaults.duration : undefined),
      videoResolution: extras.videoResolution || (defaults.videoResolution as StudioNodeData['videoResolution']),
      generateAudio: extras.generateAudio ?? (typeof defaults.generateAudio === 'boolean' ? defaults.generateAudio : undefined),
      reasoningEffort: extras.reasoningEffort || (defaults.reasoningEffort as StudioNodeData['reasoningEffort']),
      refSrc: extras.refSrc,
      src: extras.src,
      error: extras.error,
    },
    width: size.width,
    height: size.height,
    style: size,
  };
}

export function createStudioProject(input: {
  title?: string;
  pendingPrompt?: string;
  templateId?: string;
  blank?: boolean;
}): StudioProject {
  const template = STUDIO_TEMPLATES.find((item) => item.id === input.templateId);
  const title = (input.title || template?.title || '未命名项目').trim() || '未命名项目';
  const pendingPrompt = input.pendingPrompt || template?.prompt;
  const nodes: StudioNode[] = [];

  if (template) {
    nodes.push(
      createBlankNode('image', { x: 80, y: 80 }, {
        title: template.title,
        prompt: template.prompt,
        src: template.cover,
        status: 'ready',
        aspect: '16:9',
      }),
    );
  }

  const project: StudioProject = {
    id: createStudioId('p'),
    title,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    coverUrls: template ? [template.cover] : [],
    nodes,
    edges: [],
    viewport: DEFAULT_VIEWPORT,
    messages: [],
    pendingPrompt: input.blank ? undefined : pendingPrompt,
    agentOpen: true,
  };
  return saveStudioProject(project);
}

export function updateStudioGraph(
  id: string,
  patch: Partial<Pick<StudioProject, 'nodes' | 'edges' | 'viewport' | 'messages' | 'title' | 'pendingPrompt' | 'agentOpen' | 'coverUrls'>>,
): StudioProject | null {
  const current = getStudioProject(id);
  if (!current) return null;
  return saveStudioProject({ ...current, ...patch });
}

export function formatStudioDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}月${day}日修改`;
}

export function defaultViewport(): Viewport {
  return { ...DEFAULT_VIEWPORT };
}

export type { Edge, UIMessage };
