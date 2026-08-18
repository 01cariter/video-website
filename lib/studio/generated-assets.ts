import 'server-only';

import { createClient } from '@/lib/supabase/server';

function extensionFor(mediaType: string, kind: 'image' | 'video') {
  const normalized = mediaType.toLowerCase();
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('avif')) return 'avif';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('quicktime')) return 'mov';
  return kind === 'video' ? 'mp4' : 'png';
}

function safeSegment(value: string, fallback: string) {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  return safe || fallback;
}

export async function storeGeneratedAsset(input: {
  userId: string;
  projectId?: string;
  requestId: string;
  index?: number;
  kind: 'image' | 'video';
  mediaType: string;
  base64: string;
}) {
  const supabase = await createClient();
  const extension = extensionFor(input.mediaType, input.kind);
  const project = safeSegment(input.projectId || 'unfiled', 'unfiled');
  const request = safeSegment(input.requestId, 'generation');
  const path = `${input.userId}/studio/${project}/${request}-${input.index || 0}.${extension}`;
  const bytes = Buffer.from(input.base64, 'base64');
  const { error } = await supabase.storage.from('media').upload(path, bytes, {
    contentType: input.mediaType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(`Could not save generated asset: ${error.message}`);
  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}
