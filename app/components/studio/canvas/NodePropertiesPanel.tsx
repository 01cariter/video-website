'use client';

import { Bot, CopyPlus, ImageIcon, Video } from 'lucide-react';
import {
  modelForKind,
  modelOptionsForKind,
  modelSpecFor,
  type CatalogField,
} from '@/lib/studio/model-catalog';
import type { StudioNode, StudioNodeData } from '@/lib/studio/types';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { ModelMark } from './NodeInspector';
import { useStudioCanvas } from './studio-context';

function displayValue(
  field: CatalogField,
  data: StudioNodeData,
  defaults: Record<string, string | number | boolean>,
) {
  const value = data[field.key] ?? defaults[field.key];
  if (field.type === 'toggle') return value ? 'On' : 'Off';
  if (field.type === 'enum') {
    return (
      field.options.find((option) => option.id === String(value))?.label ??
      String(value)
    );
  }
  if (field.type === 'range') return `${String(value)}${field.unit}`;
  return String(value);
}

export default function NodePropertiesPanel({ node }: { node: StudioNode }) {
  const { reuseNode, sendNodesToAgent, updateNodeData } = useStudioCanvas();
  const hasContent = Boolean(node.data.src || node.data.text?.trim());
  const isGenerated = hasContent && Boolean(node.data.prompt.trim());
  const storedModelId =
    node.type === 'section'
      ? null
      : node.data.modelId || modelForKind(node.type).id;
  const model =
    node.type === 'section'
      ? null
      : modelOptionsForKind(node.type).find(
          (option) => option.id === storedModelId,
        ) ?? null;
  const spec =
    model && node.type !== 'section'
      ? modelSpecFor(node.type, model.id)
      : null;
  const parameterItems = spec
    ? spec.fields.map((field) => ({
        key: field.key,
        label: field.label,
        value: displayValue(field, node.data, spec.defaults),
      }))
    : [];
  const references = Array.isArray(node.data.refSrcs)
    ? node.data.refSrcs.length
    : node.data.refSrc
      ? 1
      : 0;

  return (
    <aside
      data-testid="studio-node-properties"
      data-moodboard-floating-occluder
      className="pointer-events-auto absolute top-3 right-3 flex max-h-[calc(100%-24px)] w-[328px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-[0_16px_50px_-28px_rgba(0,0,0,.48)] backdrop-blur-xl"
      aria-label="Node properties"
    >
      <header className="flex h-11 items-center justify-between border-b border-border px-4">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Properties
        </p>
        <span className="text-[10.5px] font-medium text-muted-foreground/70 capitalize">
          {node.type}
        </span>
      </header>

      <div className="min-h-0 overflow-y-auto p-4">
        <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
          Name
          <Input
            value={node.data.title}
            className="h-9 rounded-lg bg-background/70 text-[13px] font-medium text-foreground"
            onChange={(event) =>
              updateNodeData(node.id, { title: event.target.value })
            }
          />
        </label>

        <section className="mt-4 grid gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Preview
          </span>
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
            <label className="mt-4 grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
              Prompt
              <Textarea
                value={node.data.prompt}
                rows={4}
                className="min-h-24 resize-y rounded-lg bg-background/70 text-[13px] leading-5 text-foreground"
                onChange={(event) =>
                  updateNodeData(node.id, { prompt: event.target.value })
                }
              />
            </label>

            {storedModelId ? (
              <section className="mt-4 grid gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Generation
                </span>
                <div className="overflow-hidden rounded-xl border border-border bg-background/45">
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    {model ? <ModelMark model={model} compact /> : null}
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold">
                        {model?.label ?? storedModelId}
                      </p>
                      {model ? (
                        <p className="truncate text-[10px] text-muted-foreground">
                          {model.provider} · {model.tag}
                        </p>
                      ) : (
                        <p className="truncate text-[10px] text-muted-foreground">
                          Saved model
                        </p>
                      )}
                    </div>
                  </div>
                  {spec && (parameterItems.length || references) ? (
                    <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
                      {parameterItems.map((item) => (
                        <div
                          key={item.key}
                          className="min-w-0 bg-card px-3 py-2.5"
                        >
                          <p className="truncate text-[9.5px] font-medium text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="mt-0.5 truncate text-[11.5px] font-semibold tabular-nums">
                            {item.value}
                          </p>
                        </div>
                      ))}
                      {references ? (
                        <div className="min-w-0 bg-card px-3 py-2.5">
                          <p className="truncate text-[9.5px] font-medium text-muted-foreground">
                            References
                          </p>
                          <p className="mt-0.5 truncate text-[11.5px] font-semibold tabular-nums">
                            {references} image{references === 1 ? '' : 's'}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      <footer className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg"
          onClick={() => reuseNode(node.id)}
        >
          <CopyPlus /> Reuse
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg"
          onClick={() => sendNodesToAgent([node.id])}
        >
          <Bot /> Send to Agent
        </Button>
      </footer>
    </aside>
  );
}
