import type { MediaKind } from '@/lib/types';

export interface ComposeAssetDraft {
  url: string;
  kind: MediaKind;
  mime: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  posterUrl?: string | null;
}

export interface ComposeDraft {
  title?: string;
  body?: string;
  assets?: ComposeAssetDraft[];
}
