import {
  STUDIO_CHAT_MODEL,
  STUDIO_IMAGE_MODEL,
  STUDIO_TEXT_MODEL,
  STUDIO_VIDEO_MODEL,
} from './models';
import type { StudioNodeKind } from './types';

export type StudioImageAspect =
  | '1:1'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '3:2'
  | '2:3'
  | '2:1'
  | '1:2'
  | '19.5:9'
  | '9:19.5'
  | '20:9'
  | '9:20'
  | 'auto';

export type StudioVideoAspect = '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9' | 'adaptive';

export type CatalogField =
  | { type: 'aspect'; key: 'aspect'; label: string; options: string[] }
  | { type: 'enum'; key: string; label: string; options: { id: string; label: string }[] }
  | { type: 'range'; key: string; label: string; min: number; max: number; step: number; unit: string }
  | { type: 'stepper'; key: string; label: string; min: number; max: number }
  | { type: 'toggle'; key: string; label: string };

export interface StudioModelSpec {
  id: string;
  label: string;
  kind: StudioNodeKind;
  fields: CatalogField[];
  maxRefs: number;
  defaults: Record<string, string | number | boolean>;
}

/**
 * Capabilities are taken from Vercel AI SDK provider docs:
 * - xAI grok-imagine-image: aspect ratios + 1k only, image refs, no size param
 * - ByteDance Seedance 2.0: 4–15s, 480p/720p, listed aspect ratios, I2V + generateAudio
 * - xAI grok-4.5: reasoningEffort low | medium | high
 */
export const STUDIO_MODELS: Record<StudioNodeKind, StudioModelSpec> = {
  image: {
    id: STUDIO_IMAGE_MODEL,
    label: 'Grok Imagine',
    kind: 'image',
    maxRefs: 3,
    defaults: { aspect: '1:1', n: 1 },
    fields: [
      {
        type: 'aspect',
        key: 'aspect',
        label: '宽高比',
        options: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20', 'auto'],
      },
      { type: 'stepper', key: 'n', label: '张数', min: 1, max: 4 },
    ],
  },
  video: {
    id: STUDIO_VIDEO_MODEL,
    label: 'Seedance 2.0',
    kind: 'video',
    maxRefs: 1,
    defaults: { aspect: '16:9', duration: 5, videoResolution: '720p', generateAudio: false },
    fields: [
      {
        type: 'aspect',
        key: 'aspect',
        label: '宽高比',
        options: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
      },
      {
        type: 'enum',
        key: 'videoResolution',
        label: '分辨率',
        options: [
          { id: '480p', label: '480p' },
          { id: '720p', label: '720p' },
        ],
      },
      { type: 'range', key: 'duration', label: '时长', min: 4, max: 15, step: 1, unit: '秒' },
      { type: 'toggle', key: 'generateAudio', label: '同步音频' },
    ],
  },
  text: {
    id: STUDIO_TEXT_MODEL,
    label: 'Grok 4.5',
    kind: 'text',
    maxRefs: 0,
    defaults: { reasoningEffort: 'high' },
    fields: [
      {
        type: 'enum',
        key: 'reasoningEffort',
        label: '推理强度',
        options: [
          { id: 'low', label: '低' },
          { id: 'medium', label: '中' },
          { id: 'high', label: '高' },
        ],
      },
    ],
  },
};

export function modelForKind(kind: StudioNodeKind) {
  return STUDIO_MODELS[kind];
}

export function chatModelId() {
  return STUDIO_CHAT_MODEL;
}

export function fieldSummary(kind: StudioNodeKind, values: Record<string, unknown>) {
  const spec = modelForKind(kind);
  return spec.fields
    .map((field) => {
      const raw = values[field.key] ?? spec.defaults[field.key];
      if (field.type === 'toggle') return raw ? field.label : null;
      if (field.type === 'range') return `${raw}${field.unit}`;
      if (field.type === 'stepper') return `${raw}张`;
      if (field.type === 'enum') return field.options.find((item) => item.id === raw)?.label || String(raw);
      return String(raw);
    })
    .filter(Boolean)
    .join(' · ');
}

export function videoPixelSize(aspect: string, resolution: '480p' | '720p') {
  const short = resolution === '720p' ? 720 : 480;
  const parts = aspect.split(':').map(Number);
  const rw = parts[0] || 16;
  const rh = parts[1] || 9;
  if (rw >= rh) {
    const width = Math.round((short * rw) / rh);
    return `${width}x${short}` as `${number}x${number}`;
  }
  const height = Math.round((short * rh) / rw);
  return `${short}x${height}` as `${number}x${number}`;
}
