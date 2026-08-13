import type { Edge, Node, Viewport } from '@xyflow/react';
import type { UIMessage } from 'ai';

export type StudioNodeKind = 'image' | 'video' | 'text';
export type StudioGenStatus = 'idle' | 'generating' | 'ready' | 'error';

export interface StudioNodeData {
  kind: StudioNodeKind;
  title: string;
  prompt: string;
  status: StudioGenStatus;
  aspect: string;
  n?: number;
  duration?: number;
  videoResolution?: '480p' | '720p';
  generateAudio?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  refSrc?: string;
  src?: string;
  text?: string;
  error?: string;
  [key: string]: unknown;
}

export type StudioNode = Node<StudioNodeData, StudioNodeKind>;

export interface StudioProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  coverUrls: string[];
  nodes: StudioNode[];
  edges: Edge[];
  viewport: Viewport;
  messages: UIMessage[];
  pendingPrompt?: string;
  agentOpen: boolean;
}

export interface StudioTemplate {
  id: string;
  title: string;
  prompt: string;
  cover: string;
}

export const STUDIO_STORAGE_KEY = 'snackd-studio-v1';
export const STUDIO_STORE_VERSION = 1;
