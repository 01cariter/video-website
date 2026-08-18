'use client';

import { createClient } from '@/lib/supabase/client';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_DIRECT_UPLOAD_BYTES,
  MEDIA_BUCKET,
  kindFromMime,
  storagePathFor,
} from '@/lib/media-shared';
import type { Media, MediaKind } from '@/lib/types';

interface MediaResponse {
  media?: Media;
  error?: string;
  detail?: string;
}

export interface StudioMediaUpload {
  kind: MediaKind;
  mime: string;
  url: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  png: 'image/png',
  webm: 'video/webm',
  webp: 'image/webp',
};

function mimeForFile(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXTENSION[extension] || '';
}

export function studioMediaKind(file: File): MediaKind | null {
  const mime = mimeForFile(file);
  return ALLOWED_MEDIA_MIME_TYPES.has(mime) ? kindFromMime(mime) : null;
}

export async function uploadStudioMedia(
  file: File,
): Promise<StudioMediaUpload> {
  const mime = mimeForFile(file);
  if (!ALLOWED_MEDIA_MIME_TYPES.has(mime)) {
    throw new Error('Choose an image, MP4, WebM, or MOV file.');
  }
  if (file.size <= 0 || file.size > MAX_DIRECT_UPLOAD_BYTES) {
    throw new Error('Uploads must be between 1 byte and 50 MB.');
  }

  const probe = await probeMedia(file, mime);
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Sign in before uploading media to the canvas.');
  }

  const path = storagePathFor(user.id, file.name, mime);
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      contentType: mime,
      cacheControl: '31536000',
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  try {
    const response = await fetch('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storagePath: path,
        mime,
        width: probe.width,
        height: probe.height,
        durationSeconds: probe.durationSeconds,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as MediaResponse;
    if (!response.ok || !payload.media?.url) {
      throw new Error(
        payload.detail ||
          payload.error ||
          'The uploaded media could not be registered.',
      );
    }
    return {
      kind: kindFromMime(mime),
      mime,
      url: payload.media.url,
      width: payload.media.width ?? probe.width,
      height: payload.media.height ?? probe.height,
      durationSeconds:
        payload.media.duration_seconds ?? probe.durationSeconds,
    };
  } catch (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw error;
  }
}

function probeMedia(file: File, mime: string) {
  const objectUrl = URL.createObjectURL(file);
  const isVideo = kindFromMime(mime) === 'video';
  return new Promise<{
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
  }>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The media file took too long to read.'));
    }, 12_000);
    const finish = (
      result: {
        width: number | null;
        height: number | null;
        durationSeconds: number | null;
      },
      error?: Error,
    ) => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      if (error) reject(error);
      else resolve(result);
    };

    if (isVideo) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.onloadedmetadata = () =>
        finish({
          width: video.videoWidth || null,
          height: video.videoHeight || null,
          durationSeconds: Number.isFinite(video.duration)
            ? video.duration
            : null,
        });
      video.onerror = () =>
        finish(
          { width: null, height: null, durationSeconds: null },
          new Error('That video could not be read.'),
        );
      video.src = objectUrl;
      return;
    }

    const image = new Image();
    image.onload = () =>
      finish({
        width: image.naturalWidth || null,
        height: image.naturalHeight || null,
        durationSeconds: null,
      });
    image.onerror = () =>
      finish(
        { width: null, height: null, durationSeconds: null },
        new Error('That image could not be read.'),
      );
    image.src = objectUrl;
  });
}
