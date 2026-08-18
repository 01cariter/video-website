'use client';

import { createContext, useContext } from 'react';
import type { StudioNode, StudioNodeKind } from '@/lib/studio/types';

export type StudioTool = 'select' | 'pan' | 'section';

export interface StudioCanvasApi {
  nodes: StudioNode[];
  selectedIds: string[];
  freeCreditModelsOnly: boolean;
  addNode: (
    kind: StudioNodeKind,
    extras?: {
      prompt?: string;
      title?: string;
      text?: string;
      position?: { x: number; y: number };
      size?: { width: number; height: number };
    },
  ) => string;
  generateNode: (id: string) => Promise<void>;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  duplicateNode: (id: string) => void;
  duplicateNodes: (ids: string[]) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  updateNode: (id: string, patch: Partial<StudioNode>) => void;
  setNodeAspect: (id: string, aspect: string) => void;
  selectIds: (ids: string[]) => void;
  toggleNodeHidden: (id: string) => void;
  toggleNodeLocked: (id: string) => void;
  tool: StudioTool;
  setTool: (tool: StudioTool) => void;
  zoom: number;
  changeZoom: (zoom: number) => void;
  fitView: (ids?: string[]) => void;
}

const StudioCanvasContext = createContext<StudioCanvasApi | null>(null);

export const StudioCanvasProvider = StudioCanvasContext.Provider;

export function useStudioCanvas() {
  const value = useContext(StudioCanvasContext);
  if (!value) throw new Error('useStudioCanvas must be used inside the canvas.');
  return value;
}
