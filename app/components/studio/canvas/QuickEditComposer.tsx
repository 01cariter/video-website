'use client';

import { useState } from 'react';
import { modelSpecFor, resolveStudioModel } from '@/lib/studio/model-catalog';
import type { StudioNode, StudioNodeData } from '@/lib/studio/types';
import NodeInspector from './NodeInspector';
import type { StudioCanvasReferenceOption } from './CanvasChrome.logic';
import {
  buildQuickEditParameters,
  initialEditData,
  sourceReferences,
} from './QuickEditComposer.logic';
import { useStudioCanvas } from './studio-context';

export {
  buildQuickEditParameters,
  editModelId,
  initialEditData,
  sourceReferences,
} from './QuickEditComposer.logic';

export default function QuickEditComposer({
  node,
  canvasReferences,
  onRequestCanvasReference,
  onCancel,
}: {
  node: StudioNode;
  canvasReferences: StudioCanvasReferenceOption[];
  onRequestCanvasReference: (onPick: (src: string) => void) => void;
  onCancel: () => void;
}) {
  const { runtimeConfig, quickEditNode } = useStudioCanvas();
  const source = node.data.src?.trim() ?? '';
  const [draft, setDraft] = useState<StudioNodeData>(() =>
    initialEditData(node, runtimeConfig),
  );
  const selectedModel = resolveStudioModel(
    'image',
    draft.modelId,
    runtimeConfig,
  );
  const spec = modelSpecFor('image', selectedModel.id, runtimeConfig);

  const keepSourceReference = (sources: string[], maxRefs = spec.maxRefs) =>
    sourceReferences(source, sources, maxRefs);

  return (
    <NodeInspector
      kind="image"
      data={draft}
      canSubmit={Boolean(source && draft.prompt.trim() && spec.maxRefs > 0)}
      runtimeConfig={runtimeConfig}
      canvasReferences={canvasReferences}
      onRequestCanvasReference={onRequestCanvasReference}
      requireReferenceCapableModel
      lockedReferenceCount={1}
      submitLabel="Generate edit"
      submitShortcut="mod-enter"
      promptHint="Describe the variation or edit…"
      onCancel={onCancel}
      className="min-h-[138px] w-[min(520px,calc(100vw-48px))] max-w-full rounded-xl"
      onPromptChange={(prompt) =>
        setDraft((current) => ({ ...current, prompt }))
      }
      onFieldChange={(key, value) =>
        setDraft((current) => ({ ...current, [key]: value }))
      }
      onAspectChange={(aspect) =>
        setDraft((current) => ({ ...current, aspect }))
      }
      onRefsChange={(sources) => {
        const refs = keepSourceReference(sources);
        setDraft((current) => ({
          ...current,
          refSrc: refs[0],
          refSrcs: refs,
        }));
      }}
      onModelChange={(modelId, defaults, maxRefs) => {
        const refs = keepSourceReference(draft.refSrcs ?? [], maxRefs);
        setDraft((current) => ({
          ...current,
          ...defaults,
          modelId,
          refSrc: refs[0],
          refSrcs: refs,
        }));
      }}
      onSubmit={() => {
        quickEditNode(
          node.id,
          draft.prompt,
          buildQuickEditParameters(draft, runtimeConfig, source),
        );
        onCancel();
      }}
    />
  );
}
