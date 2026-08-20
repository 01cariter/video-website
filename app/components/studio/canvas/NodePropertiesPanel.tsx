'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, CopyPlus, ImageIcon, Sparkles, Video } from 'lucide-react';
import { fieldSummary, resolveStudioModel } from '@/lib/studio/model-catalog';
import type { StudioNode } from '@/lib/studio/types';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { useStudioCanvas } from './studio-context';

export default function NodePropertiesPanel({
  node,
  quickEditOpen,
  onQuickEditOpenChange,
}: {
  node: StudioNode;
  quickEditOpen: boolean;
  onQuickEditOpenChange: (open: boolean) => void;
}) {
  const {
    freeCreditModelsOnly,
    quickEditNode,
    reuseNode,
    sendNodesToAgent,
    updateNodeData,
  } = useStudioCanvas();
  const [instruction, setInstruction] = useState('');
  const quickEditRef = useRef<HTMLTextAreaElement>(null);
  const hasContent = Boolean(node.data.src || node.data.text?.trim());
  const isGenerated = hasContent && Boolean(node.data.prompt.trim());
  const model =
    node.type === 'section'
      ? null
      : resolveStudioModel(node.type, node.data.modelId, freeCreditModelsOnly);

  useEffect(() => {
    if (!quickEditOpen) return;
    window.requestAnimationFrame(() => quickEditRef.current?.focus());
  }, [quickEditOpen]);

  return (
    <aside
      data-testid="studio-node-properties"
      data-moodboard-floating-occluder
      className="pointer-events-auto absolute top-3 right-3 flex max-h-[calc(100%-24px)] w-[316px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-[0_16px_50px_-28px_rgba(0,0,0,.48)] backdrop-blur-xl"
      aria-label="Node properties"
    >
      <header className="border-b border-border px-4 py-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Properties
        </p>
      </header>

      <div className="min-h-0 overflow-y-auto p-4">
        <label className="grid gap-1.5 text-xs font-semibold">
          Name
          <Input
            value={node.data.title}
            className="h-10 rounded-lg bg-background/70 text-[13px]"
            onChange={(event) =>
              updateNodeData(node.id, { title: event.target.value })
            }
          />
        </label>

        <section className="mt-4 grid gap-1.5">
          <span className="text-xs font-semibold">Preview</span>
          <div className="grid min-h-32 place-items-center overflow-hidden rounded-xl border border-border bg-[var(--studio-raised)]">
            {node.type === 'image' && node.data.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={node.data.src}
                alt={node.data.title || 'Selected image'}
                className="max-h-48 w-full object-contain"
              />
            ) : node.type === 'video' && node.data.src ? (
              <video
                src={node.data.src}
                poster={node.data.posterSrc}
                className="max-h-48 w-full object-contain"
                muted
                playsInline
                controls
              />
            ) : node.type === 'text' && node.data.text ? (
              <p className="max-h-48 w-full overflow-y-auto whitespace-pre-wrap p-4 text-[13px] leading-5">
                {node.data.text}
              </p>
            ) : (
              <div className="grid place-items-center gap-2 py-8 text-muted-foreground">
                {node.type === 'video' ? (
                  <Video className="size-5" />
                ) : (
                  <ImageIcon className="size-5" />
                )}
                <span className="text-xs">No preview yet</span>
              </div>
            )}
          </div>
        </section>

        {isGenerated ? (
          <>
            <label className="mt-4 grid gap-1.5 text-xs font-semibold">
              Prompt
              <Textarea
                value={node.data.prompt}
                rows={4}
                className="min-h-24 resize-y rounded-lg bg-background/70 text-[13px] leading-5"
                onChange={(event) =>
                  updateNodeData(node.id, { prompt: event.target.value })
                }
              />
            </label>
            <section className="mt-4 rounded-xl border border-border bg-background/55 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Model
                </span>
                <span className="truncate text-right text-xs font-semibold">
                  {model?.label ?? node.data.modelId ?? 'Default'}
                </span>
              </div>
              <div className="mt-2 border-t border-border pt-2 text-[11px] leading-5 text-muted-foreground">
                {fieldSummary(node.type, node.data)}
              </div>
              {Array.isArray(node.data.refSrcs) && node.data.refSrcs.length ? (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {node.data.refSrcs.length} reference
                  {node.data.refSrcs.length === 1 ? '' : 's'}
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {quickEditOpen && hasContent ? (
          <form
            className="mt-4 rounded-xl border border-primary/25 bg-primary/[0.035] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!instruction.trim()) return;
              quickEditNode(node.id, instruction);
              setInstruction('');
              onQuickEditOpenChange(false);
            }}
          >
            <label className="grid gap-1.5 text-xs font-semibold">
              Quick edit
              <Textarea
                ref={quickEditRef}
                value={instruction}
                rows={3}
                placeholder="Describe the change…"
                className="min-h-20 resize-none rounded-lg bg-background text-[13px]"
                onChange={(event) => setInstruction(event.target.value)}
              />
            </label>
            <div className="mt-2 flex justify-end">
              <Button type="submit" size="sm" disabled={!instruction.trim()}>
                <Sparkles /> Create edit
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <footer className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-lg"
          onClick={() => reuseNode(node.id)}
        >
          <CopyPlus /> Reuse
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-lg"
          onClick={() => sendNodesToAgent([node.id])}
        >
          <Bot /> Send to Agent
        </Button>
      </footer>
    </aside>
  );
}
