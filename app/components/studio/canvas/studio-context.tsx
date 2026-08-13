'use client';

import { createContext, useContext } from 'react';
import type { StudioNodeKind } from '@/lib/studio/types';

export type StudioTool = 'select' | 'pan';

export interface StudioCanvasApi {
  addNode: (
    kind: StudioNodeKind,
    extras?: { prompt?: string; title?: string; text?: string; position?: { x: number; y: number } },
  ) => string;
  generateNode: (id: string) => Promise<void>;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  duplicateNode: (id: string) => void;
  duplicateNodes: (ids: string[]) => void;
  removeEdge: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setNodeAspect: (id: string, aspect: string) => void;
  tool: StudioTool;
  setTool: (tool: StudioTool) => void;
}

const StudioCanvasContext = createContext<StudioCanvasApi | null>(null);

export const StudioCanvasProvider = StudioCanvasContext.Provider;

export function useStudioCanvas() {
  const value = useContext(StudioCanvasContext);
  if (!value) throw new Error('useStudioCanvas must be used inside the canvas.');
  return value;
}
