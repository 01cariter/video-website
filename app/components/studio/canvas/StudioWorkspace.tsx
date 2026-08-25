'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import {
  FileText,
  ImageIcon,
  LoaderCircle,
  Sparkles,
  Video as VideoIcon,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import type { DragEvent as ReactDragEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Frame, Leafer } from '@/lib/leafer-react';
import {
  arrangeStudioNodes,
  expandSectionsForExplicitChildren,
  findOpenStudioPosition,
  sizeForAspect,
  sizeForMediaDimensions,
  type StudioArrangeAction,
} from '@/lib/studio/geometry';
import {
  probeStudioMediaUrl,
  studioMediaKind,
  uploadStudioMedia,
} from '@/lib/studio/media-upload';
import {
  parseStudioGenerationResponse,
  type StudioGenerationResponsePayload,
} from '@/lib/studio/generation-response';
import { createBlankNode, saveStudioProject } from '@/lib/studio/store';
import {
  modelSpecFor,
  resolveStudioModel,
} from '@/lib/studio/model-catalog';
import {
  estimateStudioCredits,
  type StudioBillableModelId,
  type StudioRuntimeConfig,
} from '@/lib/studio/pricing';
import {
  applyNewStudioToolOutputs,
  attachmentsForStudioNodes,
  buildStudioAgentMessageMetadata,
  buildCanvasNodeSnapshots,
  filePartsForStudioNodes,
  MAX_SELECTED_CANVAS_NODES,
  type StudioAgentAttachment,
  type StudioAgentUIMessage,
} from '@/lib/studio/agent-context';
import {
  resolveStudioAutomationAction,
  workflowGroupPosition,
} from '@/lib/studio/agent-automation';
import {
  getStudioProjectSynced,
  saveStudioProjectSynced,
} from '@/lib/studio/client-store';
import type {
  StudioCanvasOperation,
  StudioNode,
  StudioNodeData,
  StudioNodeKind,
  StudioProject,
  StudioViewport,
} from '@/lib/studio/types';
import type { AppUser, Video } from '@/lib/types';
import { cn } from '@/lib/utils';
import ComposeModal from '@/app/components/compose/ComposeModal';
import type { ComposeDraft } from '@/app/components/compose/types';
import { PUBLISHED_EVENT } from '@/app/components/shell/compose-events';
import { Button } from '@/app/components/ui/button';
import AgentPanel from './AgentPanel';
import {
  buildStudioWorkflowSummaryMessage,
  studioWorkflowLanguage,
  studioWorkflowSummaryMessageId,
  workflowReceiptsFromMessages,
} from './AgentPanel.logic';
import CanvasContextMenu from './CanvasContextMenu';
import {
  LayerPanel,
  LeftToolbar,
  NodeOverlays,
  ZoomControl,
} from './CanvasChrome';
import StudioHeader from './StudioHeader';
import { StudioCanvasNode } from './nodes';
import {
  StudioCanvasProvider,
  type StudioCanvasApi,
  type StudioReferencePickerState,
  type StudioTool,
} from './studio-context';
import {
  useLeaferStudioRuntime,
  type StudioCanvasMenuState,
} from './useLeaferStudioRuntime';
import type { StudioSkillId } from '@/lib/studio/skills/catalog';

interface StudioWorkspaceProps {
  projectId: string;
  runtimeConfig: StudioRuntimeConfig;
  user: AppUser;
}

interface AddNodeExtras {
  id?: string;
  prompt?: string;
  title?: string;
  text?: string;
  data?: Partial<StudioNodeData>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  autoGenerate?: boolean;
}

interface AgentDraftRequest {
  id: number;
  text: string;
  attachments: StudioAgentAttachment[];
}

type StudioSyncStatus = 'saved' | 'saving' | 'offline';

const STUDIO_DROP_FILE_LIMIT = 8;
const GENERATION_STATUS_POLL_LIMIT = 144;
const GENERATION_STATUS_POLL_MS = 5_000;

const DERIVED_OUTPUT_FIELDS = [
  'src',
  'posterSrc',
  'text',
  'error',
  'sourceWidth',
  'sourceHeight',
  'sourceDuration',
  'uploadMime',
  'generationRequestId',
] as const;

const EDITOR_CONFIG = {
  hideOnMove: false,
  skewable: false,
  rotateable: false,
  flipable: false,
  bright: true,
  stroke: '#2f6f7e',
  strokeWidth: 1,
  pointFill: '#fffdf9',
  pointRadius: 2,
  pointSize: 8,
};

function requestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function derivedNodeData(
  source: StudioNode,
  operation: 'reuse' | 'regenerate' | 'quick-edit',
  prompt = source.data.prompt,
) {
  const data: Partial<StudioNodeData> = { ...source.data };
  for (const key of DERIVED_OUTPUT_FIELDS) delete data[key];
  return {
    ...data,
    prompt,
    title: `${source.data.title || source.type} ${
      operation === 'reuse'
        ? 'reuse'
        : operation === 'quick-edit'
          ? 'edit'
          : 'variation'
    }`,
    status: 'idle' as const,
    hidden: false,
    locked: false,
    sourceNodeId: source.id,
    operation,
  };
}

function nodeMime(node: StudioNode) {
  if (typeof node.data.uploadMime === 'string') return node.data.uploadMime;
  const src = node.data.src?.toLowerCase() ?? '';
  if (node.type === 'video') {
    if (src.includes('.webm')) return 'video/webm';
    if (src.includes('.mov')) return 'video/quicktime';
    return 'video/mp4';
  }
  if (src.includes('.webp')) return 'image/webp';
  if (src.includes('.jpg') || src.includes('.jpeg')) return 'image/jpeg';
  if (src.includes('.gif')) return 'image/gif';
  if (src.includes('.avif')) return 'image/avif';
  return 'image/png';
}

function composeDraftFromNodes(project: StudioProject, nodes: StudioNode[]) {
  const assets = nodes.flatMap((node) => {
    if (
      (node.type !== 'image' && node.type !== 'video') ||
      typeof node.data.src !== 'string' ||
      !node.data.src.trim()
    ) {
      return [];
    }
    return [
      {
        url: node.data.src,
        kind: node.type,
        mime: nodeMime(node),
        width:
          typeof node.data.sourceWidth === 'number'
            ? node.data.sourceWidth
            : null,
        height:
          typeof node.data.sourceHeight === 'number'
            ? node.data.sourceHeight
            : null,
        durationSeconds:
          typeof node.data.sourceDuration === 'number'
            ? node.data.sourceDuration
            : null,
        posterUrl:
          typeof node.data.posterSrc === 'string'
            ? node.data.posterSrc
            : undefined,
      },
    ];
  });
  const bodyParts = nodes.flatMap((node) => {
    if (node.type === 'text' && node.data.text?.trim()) {
      return [node.data.text.trim()];
    }
    if (node.data.prompt?.trim()) return [node.data.prompt.trim()];
    return [];
  });
  const body = [...new Set(bodyParts)].join('\n\n');
  return {
    title: nodes.length === 1 ? nodes[0].data.title : project.title,
    body: body || `Created in ${project.title || 'Creator Studio'}.`,
    assets,
  } satisfies ComposeDraft;
}

function CanvasWorkspace({
  project,
  runtimeConfig,
  user,
}: {
  project: StudioProject;
  runtimeConfig: StudioRuntimeConfig;
  user: AppUser;
}) {
  const router = useRouter();
  const persistTimer = useRef<number | null>(null);
  const localPersistTimer = useRef<number | null>(null);
  const syncRetryTimer = useRef<number | null>(null);
  const latestSyncSnapshot = useRef(project);
  const syncAttempt = useRef(0);
  const persistProjectRef = useRef<(
    snapshot: StudioProject,
    options?: { keepalive?: boolean; retry?: boolean },
  ) => void>(() => undefined);
  const generating = useRef(new Set<string>());
  const generationResumeQueued = useRef(new Set<string>());
  const automationQueued = useRef(new Set<string>());
  const videoPosterProbes = useRef(new Set<string>());
  const seenTools = useRef(new Set(project.appliedToolCallIds ?? []));
  const appliedToolCallIdsRef = useRef(project.appliedToolCallIds ?? []);
  const [nodes, setNodes] = useState(project.nodes);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewport, setViewport] = useState(project.viewport);
  const [title, setTitle] = useState(project.title);
  const [agentOpen, setAgentOpen] = useState(
    () =>
      project.agentOpen &&
      (typeof window === 'undefined' ||
        window.matchMedia('(min-width: 768px)').matches),
  );
  const [tool, setTool] = useState<StudioTool>('select');
  const [layersOpen, setLayersOpen] = useState(false);
  const [menu, setMenu] = useState<StudioCanvasMenuState | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [composeDraft, setComposeDraft] = useState<ComposeDraft | null>(null);
  const [agentDraftRequest, setAgentDraftRequest] =
    useState<AgentDraftRequest | null>(null);
  const [agentContextError, setAgentContextError] = useState<Error>();
  const [toolReceiptRevision, setToolReceiptRevision] = useState(0);
  const [syncStatus, setSyncStatus] =
    useState<StudioSyncStatus>('saved');
  const [referencePicker, setReferencePicker] =
    useState<StudioReferencePickerState | null>(null);

  const persistProject = useCallback(
    async (
      snapshot: StudioProject,
      options: { keepalive?: boolean; retry?: boolean } = {},
    ) => {
      latestSyncSnapshot.current = snapshot;
      if (syncRetryTimer.current) {
        window.clearTimeout(syncRetryTimer.current);
        syncRetryTimer.current = null;
      }
      const attempt = ++syncAttempt.current;
      if (!options.keepalive) setSyncStatus('saving');
      try {
        await saveStudioProjectSynced(snapshot, {
          keepalive: options.keepalive,
          storageScope: user.id,
          throwOnRemoteFailure: true,
        });
        if (attempt === syncAttempt.current) setSyncStatus('saved');
      } catch {
        if (attempt !== syncAttempt.current) return;
        setSyncStatus('offline');
        if (options.retry === false) return;
        syncRetryTimer.current = window.setTimeout(() => {
          syncRetryTimer.current = null;
          persistProjectRef.current(latestSyncSnapshot.current);
        }, 3_000);
      }
    },
    [user.id],
  );
  useEffect(() => {
    persistProjectRef.current = (snapshot, options) => {
      void persistProject(snapshot, options);
    };
  }, [persistProject]);

  useEffect(() => {
    const retryNow = () => {
      if (syncStatus === 'offline') {
        persistProjectRef.current(latestSyncSnapshot.current);
      }
    };
    window.addEventListener('online', retryNow);
    return () => {
      window.removeEventListener('online', retryNow);
    };
  }, [syncStatus]);

  useEffect(
    () => () => {
      if (syncRetryTimer.current) {
        window.clearTimeout(syncRetryTimer.current);
      }
    },
    [],
  );
  const nodesRef = useRef(nodes);
  const viewportRef = useRef(viewport);
  const titleRef = useRef(title);
  const agentOpenRef = useRef(agentOpen);
  const messagesRef = useRef<StudioAgentUIMessage[]>(
    project.messages as StudioAgentUIMessage[],
  );
  const addNodeRef = useRef<
    (kind: StudioNodeKind, extras?: AddNodeExtras) => string
  >(() => '');
  const canvasCenterRef = useRef(() => ({ x: 320, y: 240 }));
  const fitNodesRef = useRef<(ids?: string[]) => void>(() => undefined);
  const referencePickerRef = useRef<StudioReferencePickerState | null>(null);
  const referencePickCallbackRef = useRef<((src: string) => void) | null>(
    null,
  );

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const commitNodes = useCallback(
    (update: (current: StudioNode[]) => StudioNode[]) => {
      const next = update(nodesRef.current);
      nodesRef.current = next;
      setNodes(next);
      return next;
    },
    [],
  );

  const updateAgentOpen = useCallback(
    (update: boolean | ((current: boolean) => boolean)) => {
      const next =
        typeof update === 'function' ? update(agentOpenRef.current) : update;
      agentOpenRef.current = next;
      setAgentOpen(next);
    },
    [],
  );

  const selectIds = useCallback((ids: string[]) => {
    const existing = new Set(nodesRef.current.map((node) => node.id));
    setSelectedIds(
      ids.filter((id, index) => existing.has(id) && ids.indexOf(id) === index),
    );
  }, []);

  const cancelReferencePicker = useCallback(() => {
    const current = referencePickerRef.current;
    referencePickerRef.current = null;
    referencePickCallbackRef.current = null;
    setReferencePicker(null);
    if (current) selectIds([current.targetId]);
  }, [selectIds]);

  const startReferencePicker = useCallback(
    (
      targetId: string,
      allowedIds: string[],
      onPick: (src: string) => void,
    ) => {
      const uniqueAllowedIds = allowedIds.filter(
        (id, index) => id !== targetId && allowedIds.indexOf(id) === index,
      );
      if (!uniqueAllowedIds.length) return;
      const next = { targetId, allowedIds: uniqueAllowedIds };
      referencePickerRef.current = next;
      referencePickCallbackRef.current = onPick;
      setReferencePicker(next);
      setMenu(null);
      setTool('select');
      selectIds([targetId]);
    },
    [selectIds],
  );

  const pickCanvasReference = useCallback(
    (sourceId: string) => {
      const current = referencePickerRef.current;
      if (!current?.allowedIds.includes(sourceId)) return;
      const source = nodesRef.current.find((node) => node.id === sourceId);
      const src =
        source?.type === 'image' && typeof source.data.src === 'string'
          ? source.data.src.trim()
          : '';
      if (!src) return;
      const onPick = referencePickCallbackRef.current;
      referencePickerRef.current = null;
      referencePickCallbackRef.current = null;
      setReferencePicker(null);
      selectIds([current.targetId]);
      onPick?.(src);
    },
    [selectIds],
  );

  useEffect(() => {
    if (!referencePicker) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cancelReferencePicker();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [cancelReferencePicker, referencePicker]);

  const updateNode = useCallback(
    (id: string, patch: Partial<StudioNode>) => {
      commitNodes((current) =>
        current.map((node) =>
          node.id === id
            ? {
                ...node,
                ...patch,
                rotation: 0,
                data: patch.data
                  ? { ...node.data, ...patch.data, kind: node.type }
                  : node.data,
              }
            : node,
        ),
      );
    },
    [commitNodes],
  );

  const updateNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      commitNodes((current) =>
        current.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...patch, kind: node.type } }
            : node,
        ),
      );
    },
    [commitNodes],
  );

  useEffect(() => {
    for (const node of nodes) {
      if (
        node.type !== 'video' ||
        !node.data.src ||
        node.data.posterSrc ||
        node.data.status !== 'ready'
      ) {
        continue;
      }
      const key = `${node.id}:${node.data.src}`;
      if (videoPosterProbes.current.has(key)) continue;
      videoPosterProbes.current.add(key);
      void probeStudioMediaUrl(node.data.src, 'video')
        .then((probe) => {
          const current = nodesRef.current.find((item) => item.id === node.id);
          if (!current || current.data.src !== node.data.src) return;
          const size = sizeForMediaDimensions(
            probe.width,
            probe.height,
            'video',
          );
          const preferred = {
            x: current.x + (current.width - size.width) / 2,
            y: current.y + (current.height - size.height) / 2,
          };
          const position = findOpenStudioPosition(
            nodesRef.current,
            preferred,
            size,
            { ignoreIds: [node.id] },
          );
          updateNode(node.id, {
            ...position,
            width: size.width,
            height: size.height,
          });
          updateNodeData(node.id, {
            posterSrc: probe.posterSrc,
            sourceWidth: probe.width,
            sourceHeight: probe.height,
            sourceDuration: probe.durationSeconds,
          });
        })
        .catch(() => undefined);
    }
  }, [nodes, updateNode, updateNodeData]);

  const setNodeAspect = useCallback(
    (id: string, aspect: string) => {
      commitNodes((current) =>
        current.map((node) => {
          if (node.id !== id || node.type === 'section') return node;
          const next = sizeForAspect(aspect, node.type);
          return {
            ...node,
            x: node.x + (node.width - next.width) / 2,
            y: node.y + (node.height - next.height) / 2,
            width: next.width,
            height: next.height,
            data: { ...node.data, aspect },
          };
        }),
      );
    },
    [commitNodes],
  );

  const generateNode = useCallback(
    async (id: string) => {
      if (generating.current.has(id)) return;
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node || node.type === 'section') return;
      if (!node.data.prompt.trim()) {
        updateNodeData(id, { error: 'Add a generation prompt first.' });
        return;
      }

      const generationRequestId =
        typeof node.data.generationRequestId === 'string' &&
        node.data.generationRequestId.trim()
          ? node.data.generationRequestId
          : requestId();
      generating.current.add(id);
      updateNodeData(id, {
        status: 'generating',
        error: undefined,
        generationRequestId,
      });

      try {
        const model = resolveStudioModel(
          node.type,
          node.data.modelId,
          runtimeConfig,
        );
        const spec = modelSpecFor(node.type, model.id, runtimeConfig);
        const parameters = Object.fromEntries(
          spec.fields.map((field) => [
            field.key,
            node.data[field.key] ?? spec.defaults[field.key],
          ]),
        );
        const references = (
          Array.isArray(node.data.refSrcs)
            ? node.data.refSrcs
            : node.data.refSrc
              ? [node.data.refSrc]
              : []
        ).slice(0, spec.maxRefs);
        const expectedQuote = estimateStudioCredits({
          kind: node.type,
          modelId: model.id as StudioBillableModelId,
          parameters,
          prompt: node.data.prompt,
          current: node.data.text,
          referenceImages: references,
          runtime: runtimeConfig,
        });
        const body = {
          projectId: project.id,
          nodeId: node.id,
          requestId: generationRequestId,
          prompt: node.data.prompt,
          current: node.data.text || '',
          modelId: model.id,
          parameters,
          refSrc: references[0],
          refSrcs: references,
          reasoningEffort: parameters.reasoningEffort,
          expectedCredits: expectedQuote.credits,
        };
        const endpoint =
          node.type === 'text'
            ? '/api/studio/text'
            : node.type === 'video'
              ? '/api/studio/video'
              : '/api/studio/image';
        let payload: StudioGenerationResponsePayload;
        for (let poll = 0; ; poll += 1) {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          payload = await parseStudioGenerationResponse(response, node.type);
          if (payload.status !== 'processing') break;
          if (poll >= GENERATION_STATUS_POLL_LIMIT) {
            throw new Error(
              'Generation is still processing after the recovery window. Try this node again later.',
            );
          }
          await new Promise<void>((resolve) => {
            window.setTimeout(
              resolve,
              typeof payload.retryAfterMs === 'number'
                ? Math.min(15_000, Math.max(1_000, payload.retryAfterMs))
                : GENERATION_STATUS_POLL_MS,
            );
          });
        }
        if (typeof payload.balance === 'number') {
          window.dispatchEvent(
            new CustomEvent('credits:changed', { detail: payload.balance }),
          );
        }

        if (node.type === 'text') {
          updateNodeData(id, {
            status: 'ready',
            text: payload.text || '',
            error: undefined,
            generationRequestId: undefined,
          });
          return;
        }

        const urls =
          payload.urls?.filter(Boolean) || (payload.url ? [payload.url] : []);
        if (!urls.length)
          throw new Error('The generation service returned no assets.');
        updateNodeData(id, {
          status: 'ready',
          src: urls[0],
          error: undefined,
          generationRequestId: undefined,
        });
        if (urls.length > 1) {
          commitNodes((current) => {
            const source = current.find((item) => item.id === id);
            if (!source) return current;
            const top = Math.max(0, ...current.map((item) => item.zIndex));
            const occupied = [...current];
            const copies = urls.slice(1).map((url, index) => {
              const position = findOpenStudioPosition(
                occupied,
                {
                  x: source.x + source.width + 28,
                  y: source.y,
                },
                { width: source.width, height: source.height },
              );
              const copy = createBlankNode(source.type, position, {
                ...source.data,
                src: url,
                status: 'ready',
                title: `${source.data.title} ${index + 2}`,
              });
              const next = {
                ...copy,
                width: source.width,
                height: source.height,
                zIndex: top + index + 1,
              };
              occupied.push(next);
              return next;
            });
            return current.concat(copies);
          });
        }
      } catch (error) {
        updateNodeData(id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Generation failed.',
          generationRequestId: undefined,
        });
      } finally {
        generating.current.delete(id);
      }
    },
    [commitNodes, project.id, runtimeConfig, updateNodeData],
  );

  const addNode = useCallback(
    (kind: StudioNodeKind, extras: AddNodeExtras = {}) => {
      if (extras.id) {
        const existing = nodesRef.current.find((node) => node.id === extras.id);
        if (existing) return existing.id;
      }
      const center = canvasCenterRef.current();
      const preferred = extras.position || {
        x: center.x - (extras.size?.width ?? 280) / 2,
        y: center.y - (extras.size?.height ?? 220) / 2,
      };
      const defaults =
        kind === 'section'
          ? {}
          : (() => {
              const model = resolveStudioModel(kind, undefined, runtimeConfig);
              const spec = modelSpecFor(kind, model.id, runtimeConfig);
              return { ...spec.defaults, modelId: model.id };
            })();
      const data: Partial<StudioNodeData> = {
        ...defaults,
        ...extras.data,
      };
      if (extras.prompt !== undefined) data.prompt = extras.prompt;
      if (extras.title !== undefined) data.title = extras.title;
      if (extras.text !== undefined) data.text = extras.text;
      const node = createBlankNode(kind, preferred, data);
      const size = {
        width: extras.size?.width ?? node.width,
        height: extras.size?.height ?? node.height,
      };
      const keepsWorkflowGridPosition =
        kind !== 'section' &&
        Boolean(extras.position) &&
        typeof extras.data?.groupId === 'string';
      const position =
        kind === 'section' || keepsWorkflowGridPosition
          ? preferred
          : findOpenStudioPosition(nodesRef.current, preferred, size);
      const top = Math.max(0, ...nodesRef.current.map((item) => item.zIndex));
      const next: StudioNode = {
        ...node,
        id: extras.id || node.id,
        ...position,
        ...size,
        zIndex: kind === 'section' ? -1 : top + 1,
      };
      commitNodes((current) => current.concat(next));
      setSelectedIds([next.id]);
      setTool('select');
      const autoGenerate =
        extras.autoGenerate ?? Boolean(extras.prompt?.trim());
      if (kind !== 'section' && autoGenerate && next.data.prompt.trim()) {
        window.setTimeout(() => void generateNode(next.id), 0);
      }
      return next.id;
    },
    [commitNodes, generateNode, runtimeConfig],
  );
  useEffect(() => {
    addNodeRef.current = addNode;
  }, [addNode]);

  useEffect(() => {
    for (const node of nodes) {
      if (
        node.type === 'section' ||
        node.data.status !== 'generating' ||
        generating.current.has(node.id) ||
        generationResumeQueued.current.has(node.id)
      ) {
        continue;
      }
      if (
        typeof node.data.generationRequestId !== 'string' ||
        !node.data.generationRequestId.trim()
      ) {
        updateNodeData(node.id, {
          status: 'error',
          error:
            'This generation was interrupted before it could be resumed. Generate the node again.',
        });
        continue;
      }
      generationResumeQueued.current.add(node.id);
      window.setTimeout(() => {
        generationResumeQueued.current.delete(node.id);
        void generateNode(node.id);
      }, 0);
    }
  }, [generateNode, nodes, updateNodeData]);

  useEffect(() => {
    for (const node of nodes) {
      if (automationQueued.current.has(node.id)) continue;
      const action = resolveStudioAutomationAction(node, nodes);
      if (action.type === 'wait') continue;
      if (action.type === 'fail') {
        updateNodeData(node.id, {
          status: 'error',
          error: action.error,
          agentAutoGenerate: false,
        });
        continue;
      }
      if (action.references.length) {
        updateNodeData(node.id, {
          refSrc: action.references[0],
          refSrcs: action.references,
        });
      }
      automationQueued.current.add(node.id);
      window.setTimeout(() => {
        automationQueued.current.delete(node.id);
        void generateNode(node.id);
      }, 0);
    }
  }, [generateNode, nodes, updateNodeData]);

  useEffect(() => {
    const expanded = expandSectionsForExplicitChildren(nodesRef.current);
    if (expanded !== nodesRef.current) commitNodes(() => expanded);
  }, [commitNodes, nodes]);

  const removeNodes = useCallback(
    (ids: string[]) => {
      const drop = new Set(ids);
      commitNodes((current) => current.filter((node) => !drop.has(node.id)));
      setSelectedIds((current) => current.filter((id) => !drop.has(id)));
    },
    [commitNodes],
  );

  const removeNode = useCallback(
    (id: string) => {
      removeNodes([id]);
    },
    [removeNodes],
  );

  const duplicateNodes = useCallback(
    (ids: string[]) => {
      const pick = new Set(ids);
      const sources = nodesRef.current.filter((node) => pick.has(node.id));
      if (!sources.length) return;
      const top = Math.max(0, ...nodesRef.current.map((node) => node.zIndex));
      const occupied = [...nodesRef.current];
      const copies = sources.map((source, index) => {
        const position =
          source.type === 'section'
            ? { x: source.x + 36, y: source.y + 36 }
            : findOpenStudioPosition(
                occupied,
                { x: source.x + source.width + 28, y: source.y },
                { width: source.width, height: source.height },
              );
        const copy = createBlankNode(source.type, position, source.data);
        const next = {
          ...copy,
          width: source.width,
          height: source.height,
          rotation: 0,
          zIndex: source.type === 'section' ? source.zIndex : top + index + 1,
          data: {
            ...source.data,
            title: `${source.data.title} copy`,
            status:
              source.data.status === 'generating'
                ? 'idle'
                : source.data.status,
            generationRequestId: undefined,
          },
        };
        occupied.push(next);
        return next;
      });
      commitNodes((current) => current.concat(copies));
      setSelectedIds(copies.map((node) => node.id));
    },
    [commitNodes],
  );

  const duplicateNode = useCallback(
    (id: string) => duplicateNodes([id]),
    [duplicateNodes],
  );

  const createDerivedNode = useCallback(
    (
      id: string,
      operation: 'reuse' | 'regenerate' | 'quick-edit',
      options: {
        id?: string;
        prompt?: string;
        title?: string;
        data?: Partial<StudioNodeData>;
        autoGenerate?: boolean;
      } = {},
    ) => {
      const source = nodesRef.current.find((node) => node.id === id);
      if (!source || source.type === 'section') return undefined;
      const prompt = options.prompt ?? source.data.prompt;
      const data = derivedNodeData(source, operation, prompt);
      if (options.title) data.title = options.title;
      if (operation === 'quick-edit') {
        const reference =
          source.type === 'image'
            ? source.data.src
            : source.type === 'video'
              ? source.data.posterSrc
              : undefined;
        if (reference) {
          data.refSrc = reference;
          data.refSrcs = [reference];
        }
      }
      if (options.data) Object.assign(data, options.data);
      return addNode(source.type, {
        id: options.id,
        data,
        position: {
          x: source.x + source.width + 28,
          y: source.y,
        },
        autoGenerate: options.autoGenerate,
      });
    },
    [addNode],
  );

  const reuseNode = useCallback(
    (id: string) => createDerivedNode(id, 'reuse', { autoGenerate: false }),
    [createDerivedNode],
  );

  const regenerateNode = useCallback(
    (id: string) => createDerivedNode(id, 'regenerate', { autoGenerate: true }),
    [createDerivedNode],
  );

  const quickEditNode = useCallback(
    (
      id: string,
      instruction: string,
      overrides?: Partial<StudioNodeData>,
    ) => {
      const source = nodesRef.current.find((node) => node.id === id);
      const trimmed = instruction.trim();
      if (!source || !trimmed) return;
      const prompt =
        source.type === 'text' && source.data.text
          ? `${trimmed}\n\nSource text:\n${source.data.text}`
          : trimmed;
      createDerivedNode(id, 'quick-edit', {
        prompt,
        data: overrides,
        autoGenerate: true,
      });
    },
    [createDerivedNode],
  );

  const publishNodes = useCallback(
    (ids: string[]) => {
      const byId = new Map(nodesRef.current.map((node) => [node.id, node]));
      const selected = ids
        .map((id) => byId.get(id))
        .filter((node): node is StudioNode =>
          Boolean(node?.data.src || node?.data.text?.trim()),
        );
      if (!selected.length) return;
      if (!user) {
        router.push(
          `/login?next=${encodeURIComponent(`/studio/${project.id}`)}`,
        );
        return;
      }
      setComposeDraft(composeDraftFromNodes(project, selected));
    },
    [project, router, user],
  );

  const sendNodesToAgent = useCallback(
    (ids: string[]) => {
      const contextIds = ids.slice(0, MAX_SELECTED_CANVAS_NODES);
      const attachments = attachmentsForStudioNodes(
        nodesRef.current,
        contextIds,
      );
      if (!attachments.length) return;
      setAgentDraftRequest({
        id: Date.now(),
        text:
          ids.length > MAX_SELECTED_CANVAS_NODES
            ? `Help me refine or continue the first ${MAX_SELECTED_CANVAS_NODES} of ${ids.length} selected canvas items.`
            : 'Help me refine or continue these selected canvas items.',
        attachments,
      });
      updateAgentOpen(true);
    },
    [updateAgentOpen],
  );

  const arrangeNodes = useCallback(
    (ids: string[], action: StudioArrangeAction) => {
      commitNodes((current) => arrangeStudioNodes(current, ids, action));
    },
    [commitNodes],
  );

  const bringToFront = useCallback(
    (id: string) => {
      const top = Math.max(0, ...nodesRef.current.map((node) => node.zIndex));
      updateNode(id, { zIndex: top + 1 });
    },
    [updateNode],
  );

  const sendToBack = useCallback(
    (id: string) => {
      const bottom = Math.min(
        -1,
        ...nodesRef.current.map((node) => node.zIndex),
      );
      updateNode(id, { zIndex: bottom - 1 });
    },
    [updateNode],
  );

  const toggleNodeHidden = useCallback(
    (id: string) => {
      const node = nodesRef.current.find((item) => item.id === id);
      if (node) updateNodeData(id, { hidden: !node.data.hidden });
    },
    [updateNodeData],
  );

  const toggleNodeLocked = useCallback(
    (id: string) => {
      const node = nodesRef.current.find((item) => item.id === id);
      if (node) updateNodeData(id, { locked: !node.data.locked });
    },
    [updateNodeData],
  );

  const propertiesPanelInset = useMemo(() => {
    if (referencePicker) return 0;
    if (selectedIds.length !== 1) return 0;
    const selected = nodes.find((node) => node.id === selectedIds[0]);
    return selected && selected.type !== 'section' ? 340 : 0;
  }, [nodes, referencePicker, selectedIds]);

  const {
    hostRef,
    runtimeReady,
    zoom,
    selectionRect,
    sectionDraftRect,
    snapGuides,
    handleAppReady,
    handleLayerCreated,
    changeZoom,
    fitNodes,
    canvasCenter,
    currentViewport,
  } = useLeaferStudioRuntime({
    nodes,
    selectedIds,
    tool,
    initialViewport: project.viewport,
    onSelectIds: selectIds,
    onNodesChange: (next) => {
      nodesRef.current = next;
      setNodes(next);
    },
    onViewportChange: (next) => {
      viewportRef.current = next;
      setViewport(next);
    },
    onBlankDoubleClick: (point) =>
      addNodeRef.current('image', {
        position: { x: point.x - 150, y: point.y - 150 },
      }),
    onNodeDoubleClick: (id) => {
      window.requestAnimationFrame(() => fitNodesRef.current([id]));
    },
    referencePicker,
    onReferencePick: pickCanvasReference,
    onReferencePickCancel: cancelReferencePicker,
    onSectionDraw: (rect) =>
      addNodeRef.current('section', {
        position: { x: rect.x, y: rect.y },
        size: { width: rect.width, height: rect.height },
      }),
    onContextMenu: setMenu,
    viewportInsets: {
      left: layersOpen ? 264 : 0,
      right: propertiesPanelInset,
    },
  });
  useEffect(() => {
    fitNodesRef.current = fitNodes;
  }, [fitNodes]);
  useEffect(() => {
    canvasCenterRef.current = canvasCenter;
  }, [canvasCenter]);

  const addUploadedFiles = useCallback(
    async (files: File[], point: { x: number; y: number }) => {
      const accepted = files
        .map((file) => ({ file, kind: studioMediaKind(file) }))
        .filter(
          (
            item,
          ): item is {
            file: File;
            kind: 'image' | 'video';
          } => Boolean(item.kind),
        )
        .slice(0, STUDIO_DROP_FILE_LIMIT);

      if (!accepted.length) {
        setUploadError('Drop an image, MP4, WebM, or MOV file.');
        return;
      }
      setUploadError(
        files.length > STUDIO_DROP_FILE_LIMIT
          ? `Only the first ${STUDIO_DROP_FILE_LIMIT} files were added.`
          : '',
      );
      setUploadingCount((count) => count + accepted.length);

      await Promise.all(
        accepted.map(async ({ file, kind }, index) => {
          const initialSize = sizeForMediaDimensions(null, null, kind);
          const nodeCenter = {
            x: point.x + index * 28,
            y: point.y + index * 28,
          };
          const id = addNode(kind, {
            title: file.name,
            position: {
              x: nodeCenter.x - initialSize.width / 2,
              y: nodeCenter.y - initialSize.height / 2,
            },
            size: initialSize,
            data: { status: 'uploading' },
          });
          try {
            const uploaded = await uploadStudioMedia(file, (probe) => {
              const size = sizeForMediaDimensions(
                probe.width,
                probe.height,
                kind,
              );
              const position = findOpenStudioPosition(
                nodesRef.current,
                {
                  x: nodeCenter.x - size.width / 2,
                  y: nodeCenter.y - size.height / 2,
                },
                size,
                { ignoreIds: [id] },
              );
              updateNode(id, {
                ...position,
                width: size.width,
                height: size.height,
              });
              updateNodeData(id, {
                posterSrc: probe.posterSrc,
                sourceWidth: probe.width,
                sourceHeight: probe.height,
                sourceDuration: probe.durationSeconds,
              });
            });
            const size = sizeForMediaDimensions(
              uploaded.width,
              uploaded.height,
              kind,
            );
            const position = findOpenStudioPosition(
              nodesRef.current,
              {
                x: nodeCenter.x - size.width / 2,
                y: nodeCenter.y - size.height / 2,
              },
              size,
              { ignoreIds: [id] },
            );
            updateNode(id, {
              ...position,
              width: size.width,
              height: size.height,
            });
            updateNodeData(id, {
              src: uploaded.url,
              posterSrc: uploaded.posterSrc,
              status: 'ready',
              error: undefined,
              uploadMime: uploaded.mime,
              sourceWidth: uploaded.width,
              sourceHeight: uploaded.height,
              sourceDuration: uploaded.durationSeconds,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Upload failed.';
            updateNodeData(id, { status: 'error', error: message });
            setUploadError(message);
          } finally {
            setUploadingCount((count) => Math.max(0, count - 1));
          }
        }),
      );
    },
    [addNode, updateNode, updateNodeData],
  );

  const onCanvasDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [],
  );

  const onCanvasDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.dataTransfer.files.length) {
        setUploadError('No media files were found in that drop.');
        return;
      }
      const rect = hostRef.current?.getBoundingClientRect();
      const viewport = currentViewport();
      const point = {
        x:
          ((rect ? event.clientX - rect.left : event.clientX) - viewport.x) /
          viewport.zoom,
        y:
          ((rect ? event.clientY - rect.top : event.clientY) - viewport.y) /
          viewport.zoom,
      };
      void addUploadedFiles(Array.from(event.dataTransfer.files), point);
    },
    [addUploadedFiles, currentViewport, hostRef],
  );

  const applyOperation = useCallback(
    (operation: StudioCanvasOperation) => {
      if (operation.type === 'add_node') {
        if (
          operation.node.id &&
          nodesRef.current.some((node) => node.id === operation.node.id)
        ) {
          return;
        }
        const group = operation.node.groupId
          ? nodesRef.current.find(
              (node) =>
                node.id === operation.node.groupId && node.type === 'section',
            )
          : undefined;
        const explicitPosition =
          typeof operation.node.x === 'number' &&
          typeof operation.node.y === 'number'
            ? { x: operation.node.x, y: operation.node.y }
            : undefined;
        const operationSize =
          typeof operation.node.width === 'number' &&
          typeof operation.node.height === 'number'
            ? {
                width: operation.node.width,
                height: operation.node.height,
              }
            : undefined;
        const groupPosition =
          group && typeof operation.node.groupIndex === 'number'
            ? workflowGroupPosition(group, operation.node.groupIndex)
            : undefined;
        const workflowGroupOpenPosition =
          operation.node.kind === 'section' && !explicitPosition
            ? (() => {
                const center = canvasCenterRef.current();
                const size = operationSize ?? { width: 480, height: 320 };
                return findOpenStudioPosition(
                  nodesRef.current,
                  {
                    x: center.x - size.width / 2,
                    y: center.y - size.height / 2,
                  },
                  size,
                  { gap: 48, grid: 24 },
                );
              })()
            : undefined;
        addNode(operation.node.kind, {
          id: operation.node.id,
          prompt: operation.node.prompt,
          title: operation.node.title,
          text: operation.node.text,
          data: {
            ...operation.node.parameters,
            ...(operation.node.modelId
              ? { modelId: operation.node.modelId }
              : {}),
            ...(operation.node.groupId
              ? { groupId: operation.node.groupId }
              : {}),
            agentAutoGenerate: operation.node.autoGenerate === true,
            ...(operation.node.dependsOn
              ? { agentDependsOn: operation.node.dependsOn }
              : {}),
            ...(operation.node.referenceNodeIds
              ? { agentReferenceNodeIds: operation.node.referenceNodeIds }
              : {}),
          },
          position:
            explicitPosition ?? groupPosition ?? workflowGroupOpenPosition,
          size: operationSize,
          autoGenerate: false,
        });
        return;
      }
      if (operation.type === 'create_variant') {
        if (
          operation.id &&
          nodesRef.current.some((node) => node.id === operation.id)
        ) {
          return;
        }
        const createdId = createDerivedNode(operation.sourceId, 'reuse', {
          id: operation.id,
          prompt: operation.prompt,
          title: operation.title,
          autoGenerate: operation.autoGenerate ?? true,
        });
        if (!createdId) throw new Error('Variant source no longer exists.');
        return;
      }
      if (!nodesRef.current.some((node) => node.id === operation.id)) {
        throw new Error('Canvas node no longer exists.');
      }
      const {
        x,
        y,
        width,
        height,
        rotation: _rotation,
        ...dataPatch
      } = operation.patch;
      const geometry: Partial<StudioNode> = {};
      if (typeof x === 'number') geometry.x = x;
      if (typeof y === 'number') geometry.y = y;
      if (typeof width === 'number') geometry.width = width;
      if (typeof height === 'number') geometry.height = height;
      updateNode(operation.id, geometry);
      if (Object.keys(dataPatch).length) {
        updateNodeData(operation.id, dataPatch);
      }
    },
    [addNode, createDerivedNode, updateNode, updateNodeData],
  );

  const applyPendingToolOutputs = useCallback(
    (nextMessages: UIMessage[]) => {
      const applied = applyNewStudioToolOutputs(
        nextMessages,
        seenTools.current,
        applyOperation,
      );
      if (!applied.length) return;
      appliedToolCallIdsRef.current = [
        ...new Set([...appliedToolCallIdsRef.current, ...applied]),
      ];
      setToolReceiptRevision((revision) => revision + 1);
    },
    [applyOperation],
  );

  const buildProjectSnapshot = useCallback(
    (nextMessages = messagesRef.current): StudioProject => ({
      ...project,
      title: titleRef.current.trim() || 'Untitled project',
      nodes: nodesRef.current,
      viewport: viewportRef.current,
      messages: nextMessages,
      appliedToolCallIds: appliedToolCallIdsRef.current,
      pendingPrompt: undefined,
      pendingGeneration: undefined,
      pendingAgentAttachmentIds: undefined,
      agentOpen: agentOpenRef.current,
    }),
    [project],
  );

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/studio/chat' }),
    [],
  );

  const { messages, setMessages, sendMessage, stop, status, error } =
    useChat<StudioAgentUIMessage>({
    id: project.id,
    transport,
    messages: project.messages as StudioAgentUIMessage[],
    throttle: 50,
    onFinish: ({ messages: next }) => {
      window.dispatchEvent(new Event('credits:changed'));
      messagesRef.current = next;
      applyPendingToolOutputs(next);
      void persistProject(buildProjectSnapshot(next));
    },
  });

  useEffect(() => {
    messagesRef.current = messages;
    applyPendingToolOutputs(messages);
  }, [applyPendingToolOutputs, messages]);

  useEffect(() => {
    if (status === 'submitted' || status === 'streaming') return;
    const existingIds = new Set(messages.map((message) => message.id));
    const summaries = workflowReceiptsFromMessages(messages).flatMap(
      (workflow) => {
        if (
          !seenTools.current.has(workflow.id) ||
          existingIds.has(studioWorkflowSummaryMessageId(workflow.id))
        ) {
          return [];
        }
        const summary = buildStudioWorkflowSummaryMessage(
          workflow,
          nodes,
          studioWorkflowLanguage(messages, workflow.id),
        );
        return summary ? [summary] : [];
      },
    );
    if (!summaries.length) return;
    const next = [...messages, ...summaries];
    messagesRef.current = next;
    setMessages(next);
    void persistProject(buildProjectSnapshot(next));
  }, [buildProjectSnapshot, messages, nodes, persistProject, setMessages, status]);

  const sendAgentMessage = useCallback(
    (
      text: string,
      skillIds: StudioSkillId[] = [],
      requestedIds: readonly string[] = selectedIds,
    ) => {
      const existing = new Set(nodesRef.current.map((node) => node.id));
      if (requestedIds.some((id) => !existing.has(id))) {
        setAgentContextError(
          new Error(
            'One or more attached canvas items no longer exist. Remove them or attach the current selection again.',
          ),
        );
        return false;
      }
      const contextIds = requestedIds
        .filter(
          (id, index) =>
            existing.has(id) && requestedIds.indexOf(id) === index,
        )
        .slice(0, MAX_SELECTED_CANVAS_NODES);
      setAgentContextError(undefined);
      void sendMessage(
        {
          text,
          files: filePartsForStudioNodes(nodesRef.current, contextIds),
          metadata: buildStudioAgentMessageMetadata(
            nodesRef.current,
            contextIds,
            skillIds,
          ),
        },
        {
          body: {
            requestId: requestId(),
            projectId: project.id,
            canvas: buildCanvasNodeSnapshots(nodesRef.current, contextIds),
            selectedIds: contextIds,
            skillIds,
          },
        },
      );
      return true;
    },
    [project.id, selectedIds, sendMessage],
  );

  useEffect(() => {
    if (localPersistTimer.current) {
      window.clearTimeout(localPersistTimer.current);
    }
    localPersistTimer.current = window.setTimeout(() => {
      saveStudioProject(buildProjectSnapshot(), user.id);
    }, 60);
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      void persistProject(buildProjectSnapshot());
    }, 420);
    return () => {
      if (localPersistTimer.current) {
        window.clearTimeout(localPersistTimer.current);
      }
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [
    agentOpen,
    buildProjectSnapshot,
    messages,
    nodes,
    persistProject,
    title,
    toolReceiptRevision,
    user.id,
    viewport,
  ]);

  useEffect(() => {
    let finalSaveStarted = false;
    const flushRemote = () => {
      if (finalSaveStarted) return;
      finalSaveStarted = true;
      void persistProject(buildProjectSnapshot(), {
        keepalive: true,
        retry: false,
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushRemote();
      } else {
        finalSaveStarted = false;
      }
    };
    window.addEventListener('pagehide', flushRemote);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushRemote);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushRemote();
    };
  }, [buildProjectSnapshot, persistProject]);

  const consumedPrompt = useRef(false);
  useEffect(() => {
    if (
      consumedPrompt.current ||
      (!project.pendingPrompt && !project.pendingGeneration)
    ) {
      return;
    }
    consumedPrompt.current = true;
    if (project.pendingGeneration) {
      addNode(project.pendingGeneration.kind, {
        prompt: project.pendingGeneration.prompt,
        title: project.title,
        data: project.pendingGeneration.data,
      });
      return;
    }
    if (!project.pendingPrompt) return;
    const pendingAttachmentIds = (
      project.pendingAgentAttachmentIds ?? []
    ).filter((id) => nodesRef.current.some((node) => node.id === id));
    if (pendingAttachmentIds.length) {
      setSelectedIds(pendingAttachmentIds);
      void sendAgentMessage(
        `Develop this creative direction using the attached canvas reference: ${project.pendingPrompt}`,
        [],
        pendingAttachmentIds,
      );
      return;
    }
    const kind: StudioNodeKind = /video|clip|shot|storyboard/i.test(
      project.pendingPrompt,
    )
      ? 'video'
      : 'image';
    const nodeId = addNode(kind, {
      prompt: project.pendingPrompt,
      title: project.title,
    });
    void sendAgentMessage(
      `Develop this creative direction and continue organizing the canvas: ${project.pendingPrompt}`,
      [],
      [nodeId],
    );
  }, [
    addNode,
    project.pendingGeneration,
    project.pendingAgentAttachmentIds,
    project.pendingPrompt,
    project.title,
    sendAgentMessage,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (referencePicker) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, button, a, [contenteditable="true"], [role="button"], [role="dialog"], [role="listbox"], [role="menuitem"], [role="option"]',
        )
      ) {
        return;
      }
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateNodes(selectedIds);
        return;
      }
      if (command && event.key === '0') {
        event.preventDefault();
        fitNodes();
        return;
      }
      if (event.altKey || command) return;
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        removeNodes(selectedIds);
      } else if (event.key === 'v' || event.key === 'V') {
        setTool('select');
      } else if (event.key === 'h' || event.key === 'H') {
        setTool('pan');
      } else if (event.key === 'f' || event.key === 'F') {
        setTool('section');
      } else if (event.key === 'Escape') {
        setMenu(null);
        selectIds([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    duplicateNodes,
    fitNodes,
    referencePicker,
    removeNodes,
    selectIds,
    selectedIds,
  ]);

  const api = useMemo<StudioCanvasApi>(
    () => ({
      nodes,
      selectedIds,
      runtimeConfig,
      addNode,
      generateNode,
      reuseNode,
      regenerateNode,
      quickEditNode,
      publishNodes,
      sendNodesToAgent,
      removeNode,
      removeNodes,
      duplicateNode,
      duplicateNodes,
      arrangeNodes,
      bringToFront,
      sendToBack,
      updateNodeData,
      updateNode,
      setNodeAspect,
      selectIds,
      toggleNodeHidden,
      toggleNodeLocked,
      tool,
      setTool,
      zoom,
      changeZoom,
      fitView: fitNodes,
      referencePicker,
      startReferencePicker,
      cancelReferencePicker,
    }),
    [
      addNode,
      arrangeNodes,
      bringToFront,
      duplicateNode,
      duplicateNodes,
      generateNode,
      publishNodes,
      quickEditNode,
      regenerateNode,
      reuseNode,
      sendNodesToAgent,
      nodes,
      removeNode,
      removeNodes,
      changeZoom,
      fitNodes,
      cancelReferencePicker,
      referencePicker,
      runtimeConfig,
      selectIds,
      selectedIds,
      sendToBack,
      startReferencePicker,
      setNodeAspect,
      toggleNodeHidden,
      toggleNodeLocked,
      tool,
      updateNode,
      updateNodeData,
      zoom,
    ],
  );

  const referencePickableIds = useMemo(
    () => new Set(referencePicker?.allowedIds ?? []),
    [referencePicker],
  );
  const renderedNodes = useMemo(
    () =>
      nodes
        .toSorted((a, b) => a.zIndex - b.zIndex)
        .map((node) => (
          <StudioCanvasNode
            key={node.id}
            node={node}
            referencePickable={referencePickableIds.has(node.id)}
          />
        )),
    [nodes, referencePickableIds],
  );
  const uploadingNodes = useMemo(
    () => nodes.filter((node) => node.data.status === 'uploading'),
    [nodes],
  );
  const closeAgent = useCallback(() => updateAgentOpen(false), [updateAgentOpen]);
  const addAgentNode = useCallback(
    (kind: StudioNodeKind) => addNode(kind),
    [addNode],
  );
  const sendFromAgentPanel = useCallback(
    (text: string, skillIds: StudioSkillId[], attachmentIds: string[]) => {
      const contextIds = agentDraftRequest
        ? attachmentIds
        : attachmentIds.length
          ? attachmentIds
          : selectedIds;
      const sent = sendAgentMessage(text, skillIds, contextIds);
      if (sent) {
        setAgentDraftRequest(null);
      }
      return sent;
    },
    [agentDraftRequest, selectedIds, sendAgentMessage],
  );
  const stopAgent = useCallback(() => void stop(), [stop]);
  const askAgentFromEmptyCanvas = useCallback(() => {
    setAgentDraftRequest({
      id: Date.now(),
      text: 'Help me plan the first steps for this canvas.',
      attachments: [],
    });
    updateAgentOpen(true);
  }, [updateAgentOpen]);

  return (
    <StudioCanvasProvider value={api}>
      <div className="studio-shell relative flex h-dvh overflow-hidden bg-background text-foreground">
        <div className="flex min-w-0 flex-1 flex-col">
          <StudioHeader
            title={title}
            syncStatus={syncStatus}
            onTitleChange={(next) => {
              titleRef.current = next;
              setTitle(next);
            }}
            agentOpen={agentOpen}
            onToggleAgent={() => updateAgentOpen((open) => !open)}
          />
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={hostRef}
              data-testid="studio-leafer-canvas"
              tabIndex={0}
              aria-label="Canvas workspace"
              className="studio-canvas-surface absolute inset-0 overflow-hidden focus:outline-none"
              onPointerDown={(event) => {
                const target = event.target as HTMLElement | null;
                if (
                  target?.closest(
                    'button, a, input, textarea, select, [contenteditable="true"], [data-moodboard-floating-occluder]',
                  )
                ) {
                  return;
                }
                event.currentTarget.focus({ preventScroll: true });
              }}
              onDragOver={onCanvasDragOver}
              onDrop={onCanvasDrop}
            >
              <Leafer
                fill="transparent"
                editor={EDITOR_CONFIG}
                wheel={{ preventDefault: true }}
                move={{ dragEmpty: tool === 'pan' }}
                zoom={{ min: 0.1, max: 4 }}
                onAppReady={handleAppReady}
                className={cn(
                  'h-full w-full overflow-hidden',
                  referencePicker && 'cursor-copy',
                  tool === 'pan' && 'cursor-grab active:cursor-grabbing',
                  tool === 'section' && 'cursor-crosshair',
                )}
              >
                <Frame
                  id="studio-node-layer"
                  name="nodes"
                  fill="transparent"
                  hitSelf={false}
                  isSnap={false}
                  onCreated={handleLayerCreated}
                >
                  {renderedNodes}
                </Frame>
              </Leafer>

              {referencePicker ? (
                <div
                  data-testid="studio-reference-picker"
                  data-moodboard-floating-occluder
                  className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2"
                  role="status"
                >
                  <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-card/95 px-3 py-1.5 text-[11px] font-medium shadow-md backdrop-blur-xl">
                    <ImageIcon className="size-3.5 text-primary" />
                    <span>Choose an image from canvas</span>
                    <kbd className="rounded border border-border px-1 py-0.5 text-[9px] leading-none text-muted-foreground">
                      Esc
                    </kbd>
                  </div>
                </div>
              ) : null}

              {runtimeReady && nodes.length === 0 ? (
                <section
                  data-testid="studio-empty-state"
                  className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6"
                  aria-label="Start creating"
                >
                  <div className="flex w-full max-w-[520px] flex-col items-center text-center">
                    <h2 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground/90">
                      What do you want to make?
                    </h2>
                    <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:gap-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="group pointer-events-auto h-9 rounded-full px-2.5 text-[12px] font-medium text-foreground/85 transition-[color,background-color,transform] duration-200 hover:bg-card/75 hover:text-foreground active:scale-[.98]"
                        onClick={askAgentFromEmptyCanvas}
                      >
                        <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                          <Sparkles className="size-3.5" />
                        </span>
                        Ask Agent
                      </Button>
                      <span
                        aria-hidden
                        className="mx-2.5 hidden h-5 w-px bg-border/70 sm:block"
                      />
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="group pointer-events-auto h-9 rounded-full px-2.5 text-[12px] font-medium text-muted-foreground transition-[color,background-color,transform] duration-200 hover:bg-card/75 hover:text-foreground active:scale-[.98]"
                          onClick={() => addNode('image')}
                        >
                          <span className="grid size-6 place-items-center rounded-full bg-foreground/[.045] transition-colors group-hover:bg-foreground/[.075]">
                            <ImageIcon className="size-3.5" />
                          </span>
                          Image
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="group pointer-events-auto h-9 rounded-full px-2.5 text-[12px] font-medium text-muted-foreground transition-[color,background-color,transform] duration-200 hover:bg-card/75 hover:text-foreground active:scale-[.98]"
                          onClick={() => addNode('video')}
                        >
                          <span className="grid size-6 place-items-center rounded-full bg-foreground/[.045] transition-colors group-hover:bg-foreground/[.075]">
                            <VideoIcon className="size-3.5" />
                          </span>
                          Video
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="group pointer-events-auto h-9 rounded-full px-2.5 text-[12px] font-medium text-muted-foreground transition-[color,background-color,transform] duration-200 hover:bg-card/75 hover:text-foreground active:scale-[.98]"
                          onClick={() => addNode('text')}
                        >
                          <span className="grid size-6 place-items-center rounded-full bg-foreground/[.045] transition-colors group-hover:bg-foreground/[.075]">
                            <FileText className="size-3.5" />
                          </span>
                          Text
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 text-[10.5px] text-muted-foreground/65">
                      Double-click anywhere for an image generator
                    </p>
                  </div>
                </section>
              ) : null}

              {uploadingNodes.map((node) => {
                  const iconSize = Math.max(10, 18 * viewport.zoom);
                  return (
                    <LoaderCircle
                      key={`upload-spinner-${node.id}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute z-10 animate-spin text-[#52746d] motion-reduce:animate-none"
                      strokeWidth={2}
                      style={{
                        left:
                          viewport.x +
                          (node.x + node.width / 2) * viewport.zoom,
                        top:
                          viewport.y +
                          (node.y + node.height / 2 - 22) * viewport.zoom,
                        width: iconSize,
                        height: iconSize,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  );
                })}

              {!runtimeReady ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                  Preparing the infinite canvas…
                </div>
              ) : null}

              {uploadingCount || uploadError ? (
                <div
                  className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2"
                  role={uploadError ? 'alert' : 'status'}
                >
                  <div className="flex max-w-[min(460px,calc(100vw-32px))] items-center gap-2 rounded-full border bg-card/95 px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur-xl">
                    {uploadingCount ? (
                      <LoaderCircle className="size-3.5 animate-spin text-primary" />
                    ) : null}
                    <span className={uploadError ? 'text-destructive' : ''}>
                      {uploadError ||
                        `Uploading ${uploadingCount} media ${
                          uploadingCount === 1 ? 'file' : 'files'
                        }…`}
                    </span>
                  </div>
                </div>
              ) : null}

              {snapGuides.map((guide, index) => (
                <div
                  key={`${guide.axis}-${index}`}
                  data-testid={`studio-snap-guide-${guide.axis}`}
                  className="pointer-events-none absolute z-10 bg-[#2f6f7e] shadow-[0_0_0_0.5px_rgba(47,111,126,0.24)]"
                  style={
                    guide.axis === 'x'
                      ? {
                          left: Math.round(guide.position),
                          top: Math.round(guide.start),
                          width: 1,
                          height: Math.max(
                            1,
                            Math.round(guide.end - guide.start),
                          ),
                        }
                      : {
                          left: Math.round(guide.start),
                          top: Math.round(guide.position),
                          width: Math.max(
                            1,
                            Math.round(guide.end - guide.start),
                          ),
                          height: 1,
                        }
                  }
                />
              ))}

              {sectionDraftRect ? (
                <div
                  className="pointer-events-none absolute rounded-xl border border-dashed border-[#2f6f7e]/80 bg-[#2f6f7e]/5"
                  style={{
                    left: sectionDraftRect.left,
                    top: sectionDraftRect.top,
                    width: sectionDraftRect.width,
                    height: sectionDraftRect.height,
                  }}
                />
              ) : null}

              <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
                <div className="pointer-events-auto">
                  <LeftToolbar
                    layersOpen={layersOpen}
                    onToggleLayers={() => setLayersOpen((open) => !open)}
                  />
                </div>
              </div>
              <LayerPanel
                open={layersOpen}
                onClose={() => setLayersOpen(false)}
              />
              <div className="pointer-events-none absolute bottom-3 left-3 z-20">
                <div className="pointer-events-auto">
                  <ZoomControl />
                </div>
              </div>
              <NodeOverlays
                stageRef={hostRef}
                selectionRect={selectionRect}
                leftInset={layersOpen ? 264 : 0}
                rightInset={propertiesPanelInset}
              />
              <CanvasContextMenu menu={menu} onClose={() => setMenu(null)} />
            </div>
          </div>
        </div>
        <AgentPanel
          open={agentOpen}
          onClose={closeAgent}
          title={title}
          messages={messages}
          nodes={nodes}
          status={status}
          error={agentContextError ?? error}
          onSend={sendFromAgentPanel}
          onStop={stopAgent}
          onAddNode={addAgentNode}
          draftRequest={agentDraftRequest}
        />
        <AnimatePresence>
          {composeDraft && user ? (
            <ComposeModal
              user={user}
              initialDraft={composeDraft}
              onClose={() => setComposeDraft(null)}
              onPublished={(video: Video) => {
                setComposeDraft(null);
                window.dispatchEvent(
                  new CustomEvent(PUBLISHED_EVENT, { detail: video }),
                );
                router.refresh();
              }}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </StudioCanvasProvider>
  );
}

export default function StudioWorkspace({
  projectId,
  runtimeConfig,
  user,
}: StudioWorkspaceProps) {
  const router = useRouter();
  const [project, setProject] = useState<StudioProject | null | undefined>();
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadedRequestKey, setLoadedRequestKey] = useState('');
  const requestKey = `${user.id}:${projectId}:${loadAttempt}`;

  useEffect(() => {
    let active = true;
    void getStudioProjectSynced(projectId, user.id, {
      throwOnRemoteFailure: true,
    })
      .then((value) => {
        if (!active) return;
        setLoadError('');
        setProject(value);
        setLoadedRequestKey(requestKey);
      })
      .catch((error) => {
        if (!active) return;
        setProject(undefined);
        setLoadError(
          error instanceof Error
            ? error.message
            : 'This canvas could not be loaded from the cloud.',
        );
        setLoadedRequestKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [projectId, requestKey, user.id]);

  if (loadedRequestKey === requestKey && loadError) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-md">
          <p className="font-semibold text-foreground">
            Couldn’t load this canvas
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {loadError} Your cloud data has not been deleted.
          </p>
          <button
            type="button"
            className="mt-4 bg-primary px-3.5 py-2 font-bold text-primary-foreground"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loadedRequestKey !== requestKey || project === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted-foreground">
        Opening canvas…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="grid min-h-dvh place-items-center gap-3 text-muted-foreground">
        <p>Project not found.</p>
        <button
          type="button"
          className="rounded-full bg-primary px-3.5 py-2 font-bold text-primary-foreground"
          onClick={() => router.push('/studio')}
        >
          Back to Creator Studio
        </button>
      </div>
    );
  }

  return (
    <CanvasWorkspace
      key={project.id}
      project={project}
      runtimeConfig={runtimeConfig}
      user={user}
    />
  );
}
