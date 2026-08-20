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
  videoResolution?: '480p' | '720p';
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
  [key: string]: unknown;
}

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

export interface StudioProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  coverUrls: string[];
  nodes: StudioNode[];
  viewport: StudioViewport;
  messages: UIMessage[];
  pendingPrompt?: string;
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
        kind: StudioNodeKind;
        prompt?: string;
        title?: string;
        text?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
      };
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
    }
  | { type: 'remove_nodes'; ids: string[] };

export const STUDIO_STORAGE_KEY = 'snackd-studio-v2';
export const STUDIO_LEGACY_STORAGE_KEY = 'snackd-studio-v1';
export const STUDIO_STORE_VERSION = 2;
