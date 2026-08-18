'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import byteDanceIcon from '@lobehub/icons-static-svg/icons/bytedance.svg';
import grokIcon from '@lobehub/icons-static-svg/icons/grok.svg';
import openAiIcon from '@lobehub/icons-static-svg/icons/openai.svg';
import poolsideIcon from '@lobehub/icons-static-svg/icons/poolside.svg';
import recraftIcon from '@lobehub/icons-static-svg/icons/recraft.svg';
import {
  Check,
  ChevronDown,
  ImagePlus,
  Minus,
  Plus,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import {
  fieldSummary,
  hasAvailableStudioModel,
  isStudioModelAvailable,
  modelForKind,
  modelOptionsForKind,
  resolveStudioModel,
  type CatalogField,
  type StudioModelOption,
} from '@/lib/studio/model-catalog';
import type {
  StudioGenerativeKind,
  StudioNodeData,
} from '@/lib/studio/types';
import {
  CREDIT_COSTS,
  imageCreditCost,
  videoCreditCost,
} from '@/lib/credits/config';
import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Slider } from '@/app/components/ui/slider';
import { Switch } from '@/app/components/ui/switch';
import { Textarea } from '@/app/components/ui/textarea';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/app/components/ui/toggle-group';

interface NodeInspectorProps {
  kind: StudioGenerativeKind;
  data: StudioNodeData;
  canSubmit: boolean;
  freeCreditModelsOnly: boolean;
  onPromptChange: (value: string) => void;
  onFieldChange: (key: string, value: string | number | boolean) => void;
  onAspectChange: (aspect: string) => void;
  onRefChange: (src?: string) => void;
  onSubmit: () => void;
}

const PROVIDER_ICONS = {
  ByteDance: byteDanceIcon,
  OpenAI: openAiIcon,
  Poolside: poolsideIcon,
  Recraft: recraftIcon,
  xAI: grokIcon,
} as const;

const ASPECT_LABELS: Record<string, string> = {
  '1:1': 'Square',
  '16:9': 'Landscape',
  '9:16': 'Portrait',
  '4:3': 'Classic',
  '3:4': 'Poster',
  '21:9': 'Cinematic',
  adaptive: 'Adaptive',
  auto: 'Auto',
};

function AspectGlyph({ aspect }: { aspect: string }) {
  const [w, h] =
    aspect === 'auto' || aspect === 'adaptive'
      ? [1, 1]
      : aspect.split(':').map(Number);
  const max = 23;
  const rw =
    w && h ? Math.max(9, Math.round((max * w) / Math.max(w, h))) : 15;
  const rh =
    w && h ? Math.max(9, Math.round((max * h) / Math.max(w, h))) : 15;
  return (
    <span
      className="rounded-[2.5px] border-[1.25px] border-current"
      style={{ width: rw, height: rh }}
    />
  );
}

function ModelMark({
  model,
  compact = false,
}: {
  model: StudioModelOption;
  compact?: boolean;
}) {
  const icon =
    PROVIDER_ICONS[model.provider as keyof typeof PROVIDER_ICONS] ?? grokIcon;
  return (
    <span
      className={cn(
        'studio-provider-icon-frame grid shrink-0 place-items-center',
        compact ? 'size-[22px] rounded-[7px]' : 'size-9 rounded-[10px]',
      )}
      aria-hidden
    >
      <Image
        src={icon}
        alt=""
        width={compact ? 14 : 20}
        height={compact ? 14 : 20}
        unoptimized
        className={cn(
          'studio-provider-icon',
          compact ? 'size-3.5' : 'size-5',
        )}
      />
    </span>
  );
}

function SettingControl({
  field,
  current,
  onFieldChange,
  onAspectChange,
}: {
  field: CatalogField;
  current: unknown;
  onFieldChange: (key: string, value: string | number | boolean) => void;
  onAspectChange: (aspect: string) => void;
}) {
  if (field.type === 'aspect') {
    const currentAspect = String(current);
    const options = field.options.includes(currentAspect)
      ? field.options
      : [currentAspect, ...field.options.slice(0, 4)];
    const compactGrid = options.length > 5;

    return (
      <section className="grid gap-3">
        <span className="text-[11px] font-semibold text-[var(--param-ink)]">
          Aspect ratio
        </span>
        <ToggleGroup
          type="single"
          spacing={2}
          value={currentAspect}
          onValueChange={(value) => {
            if (value) onAspectChange(value);
          }}
          className={cn(
            'grid w-full gap-2',
            compactGrid ? 'grid-cols-3' : 'grid-cols-5',
          )}
        >
          {options.map((aspect) => {
            const selected = currentAspect === aspect;
            return (
              <ToggleGroupItem
                key={aspect}
                value={aspect}
                aria-label={aspect}
                className={cn(
                  'h-[68px] flex-col gap-1 rounded-[11px] border border-[var(--param-line)] bg-[var(--param-card)] px-1 text-[var(--param-muted)] shadow-none transition-[border-color,background-color,color,transform] duration-150 hover:-translate-y-px hover:border-[var(--param-line-strong)] hover:bg-[var(--param-card-hover)] hover:text-[var(--param-ink)] active:translate-y-0',
                  selected &&
                    '!border-[var(--param-ink)] !bg-[var(--param-ink)] !text-[var(--param-inverse)] hover:!bg-[var(--param-ink)] hover:!text-[var(--param-inverse)]',
                )}
              >
                <AspectGlyph aspect={aspect} />
                <span className="grid gap-0 text-center leading-none">
                  <span className="font-mono text-[10px] font-semibold tabular-nums">
                    {aspect}
                  </span>
                  <span
                    className={cn(
                      'mt-1 text-[8.5px] font-medium',
                      selected
                        ? 'text-[var(--param-inverse)]/65'
                        : 'text-[var(--param-muted)]',
                    )}
                  >
                    {ASPECT_LABELS[aspect] ?? 'Custom'}
                  </span>
                </span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </section>
    );
  }

  if (field.type === 'enum') {
    return (
      <div className="grid gap-2.5">
        <span className="text-[10.5px] font-medium text-[var(--param-muted)]">
          {field.label}
        </span>
        <ToggleGroup
          type="single"
          spacing={2}
          value={String(current)}
          onValueChange={(value) => {
            if (value) onFieldChange(field.key, value);
          }}
          className={cn(
            'grid w-full gap-1 rounded-[9px] border border-[var(--param-line)] bg-transparent p-0.5',
            field.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
          )}
        >
          {field.options.map((option) => {
            const selected = String(current) === option.id;
            return (
              <ToggleGroupItem
                key={option.id}
                value={option.id}
                className={cn(
                  'h-8 rounded-[7px] border-0 px-2 text-[10.5px] font-medium text-[var(--param-muted)] shadow-none hover:bg-[var(--param-soft)] hover:text-[var(--param-ink)]',
                  selected &&
                    '!bg-[var(--param-ink)] !text-[var(--param-inverse)]',
                )}
              >
                {option.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>
    );
  }

  if (field.type === 'range') {
    return (
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-medium text-[var(--param-muted)]">
            {field.label}
          </span>
          <span className="rounded-[6px] border border-[var(--param-line)] px-2 py-1 font-mono text-[10px] font-medium text-[var(--param-ink)] tabular-nums">
            {String(current)}
            {field.unit}
          </span>
        </div>
        <Slider
          min={field.min}
          max={field.max}
          step={field.step}
          value={[Number(current)]}
          onValueChange={(next) =>
            onFieldChange(field.key, next[0] ?? field.min)
          }
        />
      </div>
    );
  }

  if (field.type === 'stepper') {
    const options = Array.from(
      { length: field.max - field.min + 1 },
      (_, index) => field.min + index,
    );

    if (options.length <= 5) {
      return (
        <section className="grid gap-3">
          <span className="text-[11px] font-semibold text-[var(--param-ink)]">
            {field.label}
          </span>
          <div
            className={cn(
              'grid gap-1 rounded-[11px] bg-[var(--param-soft)] p-1',
              options.length === 5 ? 'grid-cols-5' : 'grid-cols-4',
            )}
          >
            {options.map((value) => {
              const selected = Number(current) === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Generate ${value} images`}
                  className={cn(
                    'h-9 rounded-[8px] font-mono text-[11px] font-semibold text-[var(--param-muted)] tabular-nums outline-none transition-[background-color,color,box-shadow,transform] duration-150 hover:text-[var(--param-ink)] active:scale-[0.98]',
                    selected
                      ? 'bg-[var(--param-ink)] !text-[var(--param-inverse)] shadow-none hover:!text-[var(--param-inverse)]'
                      : 'hover:bg-[var(--param-card)]/70',
                  )}
                  onClick={() => onFieldChange(field.key, value)}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </section>
      );
    }

    return (
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-medium text-[var(--param-muted)]">
          {field.label}
        </span>
        <div className="flex items-center rounded-[9px] border border-[var(--param-line)] bg-transparent p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Decrease ${field.label}`}
            className="size-7 rounded-[7px] text-[var(--param-muted)] hover:bg-[var(--param-soft)] hover:text-[var(--param-ink)] focus-visible:!outline-none"
            onClick={() =>
              onFieldChange(
                field.key,
                Math.max(field.min, Number(current) - 1),
              )
            }
          >
            <Minus className="size-3" />
          </Button>
          <span className="w-9 text-center font-mono text-[11.5px] font-semibold text-[var(--param-ink)] tabular-nums">
            {String(current)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Increase ${field.label}`}
            className="size-7 rounded-[7px] text-[var(--param-muted)] hover:bg-[var(--param-soft)] hover:text-[var(--param-ink)] focus-visible:!outline-none"
            onClick={() =>
              onFieldChange(
                field.key,
                Math.min(field.max, Number(current) + 1),
              )
            }
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="grid gap-0.5">
        <label
          htmlFor={field.key}
          className="text-[10.5px] font-medium text-[var(--param-ink)]"
        >
          {field.label}
        </label>
        <span className="text-[10px] text-[var(--param-muted)]">
          Generate ambient audio with the video
        </span>
      </div>
      <Switch
        id={field.key}
        size="sm"
        className="focus-visible:!outline-none"
        checked={Boolean(current)}
        onCheckedChange={(checked) => onFieldChange(field.key, checked)}
      />
    </div>
  );
}

function promptPlaceholder(kind: StudioGenerativeKind) {
  if (kind === 'video') return 'Describe the shot, motion, pacing, and mood…';
  if (kind === 'text') return 'Describe the writing goal, tone, and key details…';
  return 'Describe the subject, lighting, composition, and style…';
}

function settingsTitle(kind: StudioGenerativeKind) {
  if (kind === 'video') return 'Video settings';
  if (kind === 'text') return 'Text settings';
  return 'Image settings';
}

function settingsDescription(kind: StudioGenerativeKind) {
  if (kind === 'video') return 'Adjust aspect, resolution, duration, and audio';
  if (kind === 'text') return 'Set the reasoning effort for this generation';
  return 'Set the aspect ratio and number of outputs';
}

export default function NodeInspector({
  kind,
  data,
  canSubmit,
  freeCreditModelsOnly,
  onPromptChange,
  onFieldChange,
  onAspectChange,
  onRefChange,
  onSubmit,
}: NodeInspectorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const spec = modelForKind(kind);
  const modelOptions = modelOptionsForKind(kind);
  const modelAvailable = hasAvailableStudioModel(
    kind,
    freeCreditModelsOnly,
  );
  const selectedModel = resolveStudioModel(
    kind,
    data.modelId,
    freeCreditModelsOnly,
  );
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
  const summary = fieldSummary(kind, values);
  const creditCost =
    kind === 'image'
      ? imageCreditCost(Number(data.n) || 1)
      : kind === 'video'
        ? videoCreditCost({
            duration: Number(data.duration) || 5,
            resolution: data.videoResolution === '480p' ? '480p' : '720p',
            generateAudio: Boolean(data.generateAudio),
          })
        : CREDIT_COSTS.text;

  useEffect(() => {
    if (busy) return;
    const frame = window.requestAnimationFrame(() =>
      inputRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [busy]);

  return (
    <Card
      className="w-[min(560px,calc(100vw-24px))] gap-0 overflow-hidden rounded-[18px] border border-border/90 bg-[var(--studio-raised)] p-0 shadow-[0_24px_60px_-32px_rgba(0,0,0,.48),0_5px_18px_-12px_rgba(0,0,0,.22)]"
      onWheel={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <CardContent className="p-0">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit && modelAvailable) onSubmit();
          }}
        >
          <div className="px-3.5 pt-3 pb-2.5">
            <Textarea
              ref={inputRef}
              rows={2}
              value={data.prompt}
              disabled={busy}
              placeholder={promptPlaceholder(kind)}
              className="max-h-32 min-h-[58px] resize-none border-0 bg-transparent px-0 py-0 text-[13.5px] leading-[21px] shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0"
              onChange={(event) => onPromptChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (canSubmit && modelAvailable) onSubmit();
                }
              }}
            />
            {data.error ? (
              <p className="mt-1.5 text-[11px] font-medium text-destructive">
                {data.error}
              </p>
            ) : null}
            {!modelAvailable ? (
              <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
                No video model is available with Vercel free credit.
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-1 border-t border-border/75 px-2 py-2">
            {spec.maxRefs > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                className="relative size-8 overflow-hidden rounded-[9px] text-muted-foreground hover:bg-[var(--studio-composer)] hover:text-foreground"
                aria-label={data.refSrc ? 'Remove reference image' : 'Add reference image'}
                onClick={() => {
                  if (data.refSrc) {
                    onRefChange(undefined);
                  } else {
                    fileRef.current?.click();
                  }
                }}
              >
                {data.refSrc ? (
                  <>
                    <Image
                      src={data.refSrc}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition-opacity hover:bg-black/50 hover:opacity-100">
                      <X className="size-3" />
                    </span>
                  </>
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
              </Button>
            ) : null}

            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || spec.fields.length === 0}
                  aria-label={`Open ${settingsTitle(kind)}`}
                  className="h-8 max-w-[148px] gap-1.5 rounded-[9px] px-2 text-[11px] font-medium text-muted-foreground hover:bg-[var(--studio-composer)] hover:text-foreground data-[state=open]:bg-[var(--studio-composer)] data-[state=open]:text-foreground"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span className="truncate">{summary}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                sideOffset={10}
                className="studio-parameter-popover w-[min(408px,calc(100vw-24px))] overflow-hidden rounded-[18px] border border-[var(--param-line)] bg-[var(--param-bg)] p-0 text-[var(--param-ink)] shadow-[0_28px_72px_-32px_rgba(0,0,0,.38),0_8px_24px_-16px_rgba(0,0,0,.16)]"
                onWheel={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <PopoverHeader className="border-b border-[var(--param-line)] px-5 py-4">
                  <PopoverTitle className="text-[13px] font-semibold tracking-[-0.015em] text-[var(--param-ink)]">
                    {settingsTitle(kind)}
                  </PopoverTitle>
                  <PopoverDescription className="mt-0.5 text-[10.5px] leading-4 text-[var(--param-muted)]">
                    {settingsDescription(kind)}
                  </PopoverDescription>
                </PopoverHeader>
                <div className="grid max-h-[440px] gap-5 overflow-y-auto bg-[var(--param-canvas)] px-5 py-4.5">
                  {spec.fields.map((field) => (
                    <div key={field.key}>
                      <SettingControl
                        field={field}
                        current={values[field.key]}
                        onFieldChange={onFieldChange}
                        onAspectChange={onAspectChange}
                      />
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={modelOpen} onOpenChange={setModelOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={`Choose model, currently ${selectedModel.label}`}
                  className="h-8 min-w-0 max-w-[174px] gap-1.5 rounded-[9px] px-2 text-[11px] font-medium hover:bg-[var(--studio-composer)] data-[state=open]:bg-[var(--studio-composer)]"
                >
                  <ModelMark model={selectedModel} compact />
                  <span className="truncate">{selectedModel.label}</span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="top"
                sideOffset={10}
                className="w-[340px] rounded-[18px] border-border/90 bg-popover p-2 shadow-[0_24px_64px_-28px_rgba(0,0,0,.4),0_8px_24px_-16px_rgba(0,0,0,.25)]"
                onWheel={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <PopoverHeader className="gap-1 px-2 pt-1.5 pb-2.5">
                  <PopoverTitle className="text-[13px] font-semibold tracking-[-0.01em]">
                    Choose a model
                  </PopoverTitle>
                  <PopoverDescription className="text-[10.5px]">
                    {freeCreditModelsOnly
                      ? 'Free-credit mode · unavailable models are disabled'
                      : 'Routed through Vercel AI Gateway'}
                  </PopoverDescription>
                </PopoverHeader>
                <div className="grid gap-1" role="listbox" aria-label="Generation model">
                  {modelOptions.map((model) => {
                    const available = isStudioModelAvailable(
                      model,
                      freeCreditModelsOnly,
                    );
                    const selected =
                      available && model.id === selectedModel.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={!available}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-left outline-none transition-colors hover:bg-muted focus-visible:!outline-none focus-visible:ring-1 focus-visible:ring-foreground/20',
                          selected && 'bg-muted',
                          !available &&
                            'cursor-not-allowed opacity-40 hover:bg-transparent',
                        )}
                        onClick={() => {
                          if (!available) return;
                          onFieldChange('modelId', model.id);
                          setModelOpen(false);
                        }}
                      >
                        <ModelMark model={model} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[12px] font-semibold">
                              {model.label}
                            </span>
                            <span className="rounded-[5px] border border-border bg-background px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                              {model.tag}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">
                            {model.provider} · {model.description}
                          </span>
                        </span>
                        <Check
                          className={cn(
                            'size-3.5 shrink-0 transition-opacity',
                            selected ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <span className="min-w-1 flex-1" />

            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit || busy || !modelAvailable}
              aria-label={`Generate for ${creditCost} credits`}
              className="h-8 min-w-[124px] gap-1.5 rounded-[9px] px-3 text-[11px] !text-primary-foreground shadow-none active:translate-y-px disabled:!text-primary-foreground/45"
            >
              <Zap className="size-3.5" />
              <span>Generate</span>
              <span className="opacity-65">· {creditCost} credits</span>
            </Button>
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
              if (typeof reader.result === 'string') {
                onRefChange(reader.result);
              }
            };
            reader.readAsDataURL(file);
          }}
        />
      ) : null}
    </Card>
  );
}
