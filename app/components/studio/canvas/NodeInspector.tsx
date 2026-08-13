'use client';

import { useEffect, useRef } from 'react';
import { ChevronDown, ImagePlus, Sparkles, X, Zap } from 'lucide-react';
import type { StudioNodeData, StudioNodeKind } from '@/lib/studio/types';
import { fieldSummary, modelForKind } from '@/lib/studio/model-catalog';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Label } from '@/app/components/ui/label';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/app/components/ui/popover';
import { Slider } from '@/app/components/ui/slider';
import { Switch } from '@/app/components/ui/switch';
import { Textarea } from '@/app/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group';

interface NodeInspectorProps {
  kind: StudioNodeKind;
  data: StudioNodeData;
  canSubmit: boolean;
  onPromptChange: (value: string) => void;
  onFieldChange: (key: string, value: string | number | boolean) => void;
  onAspectChange: (aspect: string) => void;
  onRefChange: (src?: string) => void;
  onSubmit: () => void;
}

function AspectGlyph({ aspect }: { aspect: string }) {
  const [w, h] = aspect === 'auto' || aspect === 'adaptive' ? [1, 1] : aspect.split(':').map(Number);
  const max = 18;
  const rw = w && h ? Math.max(8, Math.round((max * w) / Math.max(w, h))) : 14;
  const rh = w && h ? Math.max(8, Math.round((max * h) / Math.max(w, h))) : 14;
  return <span className="rounded-[2px] border border-current" style={{ width: rw, height: rh }} />;
}

export default function NodeInspector({
  kind,
  data,
  canSubmit,
  onPromptChange,
  onFieldChange,
  onAspectChange,
  onRefChange,
  onSubmit,
}: NodeInspectorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const spec = modelForKind(kind);
  const busy = data.status === 'generating';
  const values: Record<string, unknown> = {
    ...spec.defaults,
    aspect: data.aspect,
    n: data.n,
    duration: data.duration,
    videoResolution: data.videoResolution,
    generateAudio: data.generateAudio,
    reasoningEffort: data.reasoningEffort,
  };

  useEffect(() => {
    if (busy) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [busy]);

  return (
    <Card
      className="w-[min(520px,calc(100vw-24px))] gap-0 rounded-3xl border-0 py-3 shadow-lg"
      onWheel={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <CardContent className="space-y-3 px-3">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit();
          }}
        >
          <div className="flex items-start gap-3">
            {spec.maxRefs > 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                className="relative size-14 shrink-0 flex-col gap-0.5 rounded-2xl text-[10px] font-medium"
                aria-label="添加参考图"
                onClick={() => fileRef.current?.click()}
              >
                {data.refSrc ? (
                  <>
                    <img src={data.refSrc} alt="" className="absolute inset-0 size-full rounded-2xl object-cover" />
                    <span
                      className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-black/55 text-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRefChange(undefined);
                      }}
                    >
                      <X className="size-2.5" />
                    </span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="size-4" />
                    参考图
                  </>
                )}
              </Button>
            ) : null}
            <Textarea
              ref={inputRef}
              rows={3}
              value={data.prompt}
              disabled={busy}
              placeholder="今天我们要创作什么"
              className="min-h-[72px] resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"
              onChange={(event) => onPromptChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (canSubmit) onSubmit();
                }
              }}
            />
          </div>

          {data.error ? <p className="text-xs font-medium text-destructive">{data.error}</p> : null}

          <div className="flex items-center justify-between gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" disabled={busy || spec.fields.length === 0} className="text-foreground">
                  {fieldSummary(kind, values)}
                  <ChevronDown />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-80" onWheel={(event) => event.stopPropagation()}>
                <PopoverHeader className="mb-3">
                  <PopoverTitle>{kind === 'video' ? '视频设置' : kind === 'text' ? '文本设置' : '图像设置'}</PopoverTitle>
                </PopoverHeader>
                <div className="grid gap-4">
                  {spec.fields.map((field) => {
                    const current = values[field.key];
                    if (field.type === 'aspect') {
                      return (
                        <div key={field.key} className="grid gap-2">
                          <Label>{field.label}</Label>
                          <ToggleGroup
                            type="single"
                            spacing={2}
                            value={String(current)}
                            onValueChange={(value) => {
                              if (value) onAspectChange(value);
                            }}
                            className="grid w-full grid-cols-4"
                          >
                            {field.options.map((aspect) => (
                              <ToggleGroupItem
                                key={aspect}
                                value={aspect}
                                aria-label={aspect}
                                className="h-[68px] flex-col gap-1.5 rounded-xl px-1 text-[11px]"
                              >
                                <AspectGlyph aspect={aspect} />
                                {aspect}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>
                      );
                    }
                    if (field.type === 'enum') {
                      return (
                        <div key={field.key} className="grid gap-2">
                          <Label>{field.label}</Label>
                          <ToggleGroup
                            type="single"
                            variant="outline"
                            value={String(current)}
                            onValueChange={(value) => {
                              if (value) onFieldChange(field.key, value);
                            }}
                          >
                            {field.options.map((option) => (
                              <ToggleGroupItem key={option.id} value={option.id}>
                                {option.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>
                      );
                    }
                    if (field.type === 'range') {
                      return (
                        <div key={field.key} className="grid gap-2">
                          <div className="flex items-center justify-between">
                            <Label>{field.label}</Label>
                            <span className="text-muted-foreground text-xs">
                              {String(current)}
                              {field.unit}
                            </span>
                          </div>
                          <Slider
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={[Number(current)]}
                            onValueChange={(next) => onFieldChange(field.key, next[0] ?? field.min)}
                          />
                        </div>
                      );
                    }
                    if (field.type === 'stepper') {
                      return (
                        <div key={field.key} className="flex items-center justify-between">
                          <Label>{field.label}</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              onClick={() => onFieldChange(field.key, Math.max(field.min, Number(current) - 1))}
                            >
                              −
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">{String(current)}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              onClick={() => onFieldChange(field.key, Math.min(field.max, Number(current) + 1))}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={field.key} className="flex items-center justify-between">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Switch
                          id={field.key}
                          checked={Boolean(current)}
                          onCheckedChange={(checked) => onFieldChange(field.key, checked)}
                        />
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 font-medium">
                <Sparkles className="size-3" />
                {spec.label}
              </Badge>
              <Button type="submit" size="icon" disabled={!canSubmit} aria-label="生成">
                <Zap />
              </Button>
            </div>
          </div>
        </form>
      </CardContent>

      {spec.maxRefs > 0 ? (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') onRefChange(reader.result);
            };
            reader.readAsDataURL(file);
          }}
        />
      ) : null}
    </Card>
  );
}
