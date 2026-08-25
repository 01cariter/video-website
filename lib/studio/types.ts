import type { UIMessage } from 'ai';

export type StudioNodeKind = 'image' | 'video' | 'text' | 'section';
export type StudioGenerativeKind = Exclude<StudioNodeKind, 'section'>;
export type StudioGenStatus =
  | 'idle'
  | 'uploading'
  | 'generating'
  | 'ready'
  | 'error';

export interface StudioNodeData {
  kind: StudioNodeKind;
  title: string;
  prompt: string;
  status: StudioGenStatus;
  aspect: string;
  modelId?: string;
  n?: number;
  duration?: number;
  videoResolution?: '480p' | '720p' | '1080p' | '2k' | '4k';
  generateAudio?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  refSrc?: string;
  refSrcs?: string[];
  src?: string;
  posterSrc?: string;
  text?: string;
  error?: string;
  hidden?: boolean;
  locked?: boolean;
  /** Stable section membership used by Agent-created workflows. */
  groupId?: string;
  /** Resume-safe generation intent for Agent-created nodes. */
  agentAutoGenerate?: boolean;
  /** Nodes that must finish before this node can generate. */
  agentDependsOn?: string[];
  /** Ready image nodes whose assets become this node's references. */
  agentReferenceNodeIds?: string[];
  /** Stable idempotency key used to resume a generation after navigation. */
  generationRequestId?: string;
  [key: string]: unknown;
}

export type StudioOperationParameter = string | number | boolean;

export interface StudioNode {
  id: string;
  type: StudioNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  data: StudioNodeData;
}

export interface StudioViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface StudioPendingGeneration {
  kind: StudioGenerativeKind;
  prompt: string;
  data?: Partial<StudioNodeData>;
}

export interface StudioProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  persistenceVersion?: number;
  coverUrls: string[];
  nodes: StudioNode[];
  viewport: StudioViewport;
  messages: UIMessage[];
  appliedToolCallIds?: string[];
  pendingPrompt?: string;
  pendingGeneration?: StudioPendingGeneration;
  agentOpen: boolean;
}

export interface StudioTemplate {
  id: string;
  title: string;
  description: string;
  category: 'Study' | 'Training';
  prompt: string;
  cover: string;
}

export type StudioCanvasOperation =
  | {
      type: 'add_node';
      node: {
        id?: string;
        kind: StudioNodeKind;
        prompt?: string;
        title?: string;
        text?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        modelId?: string;
        parameters?: Record<string, StudioOperationParameter>;
        autoGenerate?: boolean;
        dependsOn?: string[];
        referenceNodeIds?: string[];
        groupId?: string;
        groupIndex?: number;
      };
    }
  | {
      type: 'create_variant';
      id?: string;
      sourceId: string;
      prompt?: string;
      title?: string;
      autoGenerate?: boolean;
    }
  | {
      type: 'update_node';
      id: string;
      patch: Partial<StudioNodeData> & {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        rotation?: number;
      };
    };

export const STUDIO_STORAGE_KEY = 'snackd-studio-v2';
export const STUDIO_LEGACY_STORAGE_KEY = 'snackd-studio-v1';
export const STUDIO_STORE_VERSION = 2;
export const STUDIO_PERSISTENCE_VERSION = 2;
