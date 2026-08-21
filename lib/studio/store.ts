import { sizeForAspect } from './geometry';
import { modelForKind } from './model-catalog';
import { STUDIO_TEMPLATES } from './templates';
import type {
  StudioNode,
  StudioNodeData,
  StudioNodeKind,
  StudioPendingGeneration,
  StudioProject,
  StudioViewport,
} from './types';
import {
  STUDIO_LEGACY_STORAGE_KEY,
  STUDIO_STORAGE_KEY,
  STUDIO_STORE_VERSION,
} from './types';

interface StudioStoreFile {
  version: number;
  projects: StudioProject[];
}

const DEFAULT_VIEWPORT: StudioViewport = { x: 72, y: 64, zoom: 1 };
const MAX_STUDIO_NODE_DIMENSION = 10_000;

function nowIso() {
  return new Date().toISOString();
}

export function createStudioId(prefix = 'p') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function emptyStore(): StudioStoreFile {
  return { version: STUDIO_STORE_VERSION, projects: [] };
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProjectTitle(value: unknown) {
  const title = String(value || '').trim();
  return !title || title === '未命名项目' ? 'Untitled project' : title;
}

function normalizeNodeTitle(kind: StudioNodeKind, value: unknown) {
  const title = String(value || '').trim();
  const legacyDefaults = new Set(['分组', '图片生成', '视频生成', '文本']);
  if (title && !legacyDefaults.has(title)) return title;
  return kind === 'section'
    ? 'Group'
    : kind === 'image'
      ? 'Image generation'
      : kind === 'video'
        ? 'Video generation'
        : 'Text';
}

function legacyAppliedToolCallIds(messages: unknown[]) {
  const ids = new Set<string>();
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;
    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      const value = part as Record<string, unknown>;
      if (
        typeof value.type === 'string' &&
        value.type.startsWith('tool-') &&
        value.state === 'output-available' &&
        typeof value.toolCallId === 'string' &&
        value.toolCallId.length <= 160
      ) {
        ids.add(value.toolCallId);
      }
    }
  }
  return [...ids];
}

function normalizeNode(value: unknown, index: number): StudioNode | null {
  if (!value || typeof value !== 'object') return null;
  const legacy = value as Record<string, unknown>;
  const rawData =
    legacy.data && typeof legacy.data === 'object'
      ? (legacy.data as Partial<StudioNodeData>)
      : {};
  const kind = String(legacy.type || rawData.kind || 'image') as StudioNodeKind;
  if (!['image', 'video', 'text', 'section'].includes(kind)) return null;
  const position =
    legacy.position && typeof legacy.position === 'object'
      ? (legacy.position as { x?: number; y?: number })
      : undefined;
  const style =
    legacy.style && typeof legacy.style === 'object'
      ? (legacy.style as { width?: number; height?: number })
      : undefined;
  const defaults = sizeForAspect(String(rawData.aspect || '1:1'), kind);
  const width = Math.min(
    MAX_STUDIO_NODE_DIMENSION,
    Math.max(1, numberValue(legacy.width ?? style?.width, defaults.width)),
  );
  const height = Math.min(
    MAX_STUDIO_NODE_DIMENSION,
    Math.max(1, numberValue(legacy.height ?? style?.height, defaults.height)),
  );
  const normalizedStatus =
    rawData.status === 'generating' || rawData.status === 'uploading'
      ? 'idle'
      : rawData.status || (rawData.src || rawData.text ? 'ready' : 'idle');
  const refSrcs = Array.isArray(rawData.refSrcs)
    ? rawData.refSrcs.filter(
        (src): src is string => typeof src === 'string' && Boolean(src),
      )
    : rawData.refSrc
      ? [rawData.refSrc]
      : [];
  return {
    id: String(legacy.id || createStudioId('n')),
    type: kind,
    x: numberValue(legacy.x ?? position?.x, 80 + index * 24),
    y: numberValue(legacy.y ?? position?.y, 80 + index * 24),
    width,
    height,
    rotation: 0,
    zIndex: numberValue(legacy.zIndex, index),
    data: {
      ...rawData,
      prompt: String(rawData.prompt || ''),
      status: normalizedStatus as StudioNodeData['status'],
      aspect: String(rawData.aspect || (kind === 'video' ? '16:9' : '1:1')),
      kind,
      title: normalizeNodeTitle(kind, rawData.title),
      refSrc: refSrcs[0],
      refSrcs,
    },
  };
}

export function normalizeStudioProject(value: unknown): StudioProject | null {
  if (!value || typeof value !== 'object') return null;
  const project = value as Partial<StudioProject> & {
    viewport?: Partial<StudioViewport>;
    nodes?: unknown[];
  };
  if (!project.id) return null;
  const createdAt = String(project.createdAt || nowIso());
  const pendingGenerationValue =
    project.pendingGeneration &&
    typeof project.pendingGeneration === 'object'
      ? (project.pendingGeneration as Partial<StudioPendingGeneration>)
      : undefined;
  const pendingGenerationKind = String(
    pendingGenerationValue?.kind || '',
  ) as StudioPendingGeneration['kind'];
  const pendingGenerationPrompt = String(
    pendingGenerationValue?.prompt || '',
  ).trim();
  const pendingGeneration =
    ['image', 'video', 'text'].includes(pendingGenerationKind) &&
    pendingGenerationPrompt
      ? {
          kind: pendingGenerationKind,
          prompt: pendingGenerationPrompt,
          data:
            pendingGenerationValue?.data &&
            typeof pendingGenerationValue.data === 'object'
              ? pendingGenerationValue.data
              : undefined,
        }
      : undefined;
  const messages = Array.isArray(project.messages) ? project.messages : [];
  const hasExplicitToolReceipts = Object.prototype.hasOwnProperty.call(
    project,
    'appliedToolCallIds',
  );
  return {
    id: String(project.id),
    title: normalizeProjectTitle(project.title),
    createdAt,
    updatedAt: String(project.updatedAt || createdAt),
    revision: Math.max(0, Math.trunc(numberValue(project.revision, 0))),
    coverUrls: Array.isArray(project.coverUrls)
      ? project.coverUrls.filter((url): url is string => typeof url === 'string')
      : [],
    nodes: Array.isArray(project.nodes)
      ? project.nodes
          .map((node, index) => normalizeNode(node, index))
          .filter((node): node is StudioNode => Boolean(node))
      : [],
    viewport: {
      x: numberValue(project.viewport?.x, DEFAULT_VIEWPORT.x),
      y: numberValue(project.viewport?.y, DEFAULT_VIEWPORT.y),
      zoom: Math.min(4, Math.max(0.1, numberValue(project.viewport?.zoom, 1))),
    },
    messages,
    appliedToolCallIds: Array.isArray(project.appliedToolCallIds)
      ? [
          ...new Set(
            project.appliedToolCallIds.filter(
              (id): id is string => typeof id === 'string' && id.length <= 160,
            ),
          ),
        ]
      : hasExplicitToolReceipts
        ? []
        : legacyAppliedToolCallIds(messages),
    pendingPrompt:
      typeof project.pendingPrompt === 'string' ? project.pendingPrompt : undefined,
    pendingGeneration,
    agentOpen: project.agentOpen !== false,
  };
}

function parseStore(raw: string | null): StudioStoreFile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { projects?: unknown[] };
    if (!Array.isArray(parsed.projects)) return null;
    return {
      version: STUDIO_STORE_VERSION,
      projects: parsed.projects
        .map(normalizeStudioProject)
        .filter((project): project is StudioProject => Boolean(project)),
    };
  } catch {
    return null;
  }
}

function readStore(): StudioStoreFile {
  if (typeof window === 'undefined') return emptyStore();
  const current = parseStore(window.localStorage.getItem(STUDIO_STORAGE_KEY));
  if (current) return current;
  const legacy = parseStore(
    window.localStorage.getItem(STUDIO_LEGACY_STORAGE_KEY),
  );
  if (legacy) {
    writeStore(legacy);
    return legacy;
  }
  return seedStore();
}

function writeStore(file: StudioStoreFile) {
  if (typeof window === 'undefined') return;
  const next = { ...file, version: STUDIO_STORE_VERSION };
  try {
    window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(next));
  } catch {
    const slim = {
      ...next,
      projects: next.projects.map((project) => ({
        ...project,
        nodes: project.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            src:
              node.data.src && node.data.src.startsWith('data:')
                ? undefined
                : node.data.src,
            refSrc:
              node.data.refSrc && node.data.refSrc.startsWith('data:')
                ? undefined
                : node.data.refSrc,
            refSrcs: node.data.refSrcs?.filter(
              (src) => !src.startsWith('data:'),
            ),
            posterSrc:
              node.data.posterSrc && node.data.posterSrc.startsWith('data:')
                ? undefined
                : node.data.posterSrc,
          },
        })),
      })),
    };
    try {
      window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(slim));
    } catch {
      // Keep the current in-memory canvas usable if storage is exhausted.
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
  index: number,
): StudioNode {
  return {
    id,
    type: 'image',
    x,
    y,
    width: 260,
    height: 260,
    rotation: 0,
    zIndex: index,
    data: {
      kind: 'image',
      title,
      prompt,
      status: 'ready',
      aspect: '1:1',
      src,
    },
  };
}

function seedStore(): StudioStoreFile {
  const created = nowIso();
  const file: StudioStoreFile = {
    version: STUDIO_STORE_VERSION,
    projects: [
      {
        id: 'demo-sky',
        title: 'Untitled project',
        createdAt: created,
        updatedAt: new Date(
          Date.now() - 1000 * 60 * 60 * 24 * 30,
        ).toISOString(),
        revision: 0,
        coverUrls: [
          '/studio/sky-1.jpg',
          '/studio/sky-2.jpg',
          '/studio/sky-3.jpg',
          '/studio/sky-4.jpg',
        ],
        nodes: [
          demoImageNode(
            'n1',
            'Night sky 01',
            'Milky Way above the pine ridge',
            '/studio/sky-1.jpg',
            40,
            40,
            0,
          ),
          demoImageNode(
            'n2',
            'Night sky 02',
            'Milky Way reflected on the lake',
            '/studio/sky-2.jpg',
            340,
            40,
            1,
          ),
          demoImageNode(
            'n3',
            'Night sky 03',
            'Long exposure over snowy peaks',
            '/studio/sky-3.jpg',
            40,
            340,
            2,
          ),
          demoImageNode(
            'n4',
            'Night sky 04',
            'Aurora above the lake',
            '/studio/sky-4.jpg',
            340,
            340,
            3,
          ),
        ],
        viewport: DEFAULT_VIEWPORT,
        messages: [],
        appliedToolCallIds: [],
        agentOpen: true,
      },
    ],
  };
  writeStore(file);
  return file;
}

export function listStudioProjects(): StudioProject[] {
  return [...readStore().projects].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1,
  );
}

export function getStudioProject(id: string): StudioProject | null {
  return readStore().projects.find((project) => project.id === id) ?? null;
}

export function saveStudioProject(next: StudioProject): StudioProject {
  const file = readStore();
  const index = file.projects.findIndex((item) => item.id === next.id);
  const previous = index >= 0 ? file.projects[index] : null;
  const covers = next.nodes
    .map((node) => node.data.src)
    .filter((src): src is string => Boolean(src))
    .slice(0, 4);
  const project: StudioProject = {
    ...next,
    coverUrls: covers.length ? covers : next.coverUrls,
    updatedAt: nowIso(),
    revision: Math.max(next.revision, previous?.revision ?? 0) + 1,
  };
  if (index >= 0) file.projects[index] = project;
  else file.projects.unshift(project);
  writeStore(file);
  return project;
}

export function cacheStudioProject(next: StudioProject): StudioProject {
  const file = readStore();
  const covers = next.nodes
    .map((node) => node.data.src)
    .filter((src): src is string => Boolean(src))
    .slice(0, 4);
  const project: StudioProject = {
    ...next,
    coverUrls: covers.length ? covers : next.coverUrls,
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
  return saveStudioProject({
    ...current,
    title: title.trim() || 'Untitled project',
  });
}

export function createBlankNode(
  kind: StudioNodeKind,
  position: { x: number; y: number },
  extras: Partial<StudioNodeData> = {},
): StudioNode {
  const titles: Record<StudioNodeKind, string> = {
    image: 'Image generation',
    video: 'Video generation',
    text: 'Text',
    section: 'Group',
  };
  const defaults =
    kind === 'section' ? { aspect: '3:2' } : modelForKind(kind).defaults;
  const aspect = String(
    extras.aspect || defaults.aspect || (kind === 'video' ? '16:9' : '1:1'),
  );
  const size =
    kind === 'section'
      ? { width: 480, height: 320 }
      : sizeForAspect(aspect, kind);
  const refSrcs = (
    Array.isArray(extras.refSrcs)
      ? extras.refSrcs
      : extras.refSrc
        ? [extras.refSrc]
        : []
  ).filter(Boolean);
  return {
    id: createStudioId('n'),
    type: kind,
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    rotation: 0,
    zIndex: kind === 'section' ? -1 : 0,
    data: {
      ...extras,
      kind,
      title: extras.title || titles[kind],
      prompt: extras.prompt || '',
      text: extras.text || '',
      status:
        extras.status ||
        (extras.src || extras.text || kind === 'section' ? 'ready' : 'idle'),
      aspect,
      ...(kind === 'section'
        ? {}
        : {
            modelId: extras.modelId || modelForKind(kind).id,
            n:
              extras.n ??
              (typeof defaults.n === 'number' ? defaults.n : 1),
            duration:
              extras.duration ??
              (typeof defaults.duration === 'number'
                ? defaults.duration
                : undefined),
            videoResolution:
              extras.videoResolution ||
              (defaults.videoResolution as StudioNodeData['videoResolution']),
            generateAudio:
              extras.generateAudio ??
              (typeof defaults.generateAudio === 'boolean'
                ? defaults.generateAudio
                : undefined),
            reasoningEffort:
              extras.reasoningEffort ||
              (defaults.reasoningEffort as StudioNodeData['reasoningEffort']),
          }),
      refSrc: refSrcs[0],
      refSrcs,
      src: extras.src,
      posterSrc: extras.posterSrc,
      error: extras.error,
      hidden: extras.hidden,
      locked: extras.locked,
    },
  };
}

export function createStudioProjectDraft(input: {
  title?: string;
  pendingPrompt?: string;
  pendingGeneration?: StudioPendingGeneration;
  templateId?: string;
  blank?: boolean;
}): StudioProject {
  const template = STUDIO_TEMPLATES.find((item) => item.id === input.templateId);
  const title =
    (input.title || template?.title || 'Untitled project').trim() ||
    'Untitled project';
  const pendingPrompt = input.pendingPrompt || template?.prompt;
  const nodes: StudioNode[] = [];
  if (template) {
    nodes.push(
      createBlankNode(
        'image',
        { x: 80, y: 80 },
        {
          title: template.title,
          prompt: template.prompt,
          src: template.cover,
          status: 'ready',
          aspect: '16:9',
        },
      ),
    );
  }
  const now = nowIso();
  return {
    id: createStudioId('p'),
    title,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    coverUrls: template ? [template.cover] : [],
    nodes,
    viewport: DEFAULT_VIEWPORT,
    messages: [],
    appliedToolCallIds: [],
    pendingPrompt:
      input.blank || input.pendingGeneration ? undefined : pendingPrompt,
    pendingGeneration: input.blank ? undefined : input.pendingGeneration,
    agentOpen: true,
  };
}

export function createStudioProject(input: {
  title?: string;
  pendingPrompt?: string;
  pendingGeneration?: StudioPendingGeneration;
  templateId?: string;
  blank?: boolean;
}): StudioProject {
  return saveStudioProject(createStudioProjectDraft(input));
}

export function updateStudioGraph(
  id: string,
  patch: Partial<StudioProject>,
): StudioProject | null {
  const current = getStudioProject(id);
  if (!current) return null;
  return saveStudioProject({ ...current, ...patch, id: current.id });
}

export function formatStudioDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
