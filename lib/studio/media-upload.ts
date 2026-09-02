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
  id: number;
  kind: MediaKind;
  mime: string;
  url: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  posterSrc?: string;
}

export interface StudioMediaProbe {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  posterSrc?: string;
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
  onProbe?: (probe: StudioMediaProbe) => void,
): Promise<StudioMediaUpload> {
  const mime = mimeForFile(file);
  if (!ALLOWED_MEDIA_MIME_TYPES.has(mime)) {
    throw new Error('Choose an image, MP4, WebM, or MOV file.');
  }
  if (file.size <= 0 || file.size > MAX_DIRECT_UPLOAD_BYTES) {
    throw new Error('Uploads must be between 1 byte and 50 MB.');
  }

  const probe = await probeStudioMedia(file, mime);
  onProbe?.(probe);
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
      id: payload.media.id,
      kind: kindFromMime(mime),
      mime,
      url: payload.media.url,
      width: payload.media.width ?? probe.width,
      height: payload.media.height ?? probe.height,
      durationSeconds:
        payload.media.duration_seconds ?? probe.durationSeconds,
      posterSrc: probe.posterSrc,
    };
  } catch (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw error;
  }
}

function videoPoster(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    return undefined;
  }
  const maxDimension = 960;
  const scale = Math.min(
    1,
    maxDimension / Math.max(video.videoWidth, video.videoHeight),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function probeVideoSource(
  source: string,
  options: { revoke?: boolean; crossOrigin?: boolean } = {},
) {
  return new Promise<StudioMediaProbe>((resolve, reject) => {
    let settled = false;
    let metadata: StudioMediaProbe | null = null;
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    if (options.crossOrigin) video.crossOrigin = 'anonymous';

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
      if (options.revoke) URL.revokeObjectURL(source);
    };
    const finish = (result: StudioMediaProbe, error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(result);
    };
    const capture = () => {
      const posterSrc = (() => {
        try {
          return videoPoster(video);
        } catch {
          return undefined;
        }
      })();
      finish({ ...(metadata || emptyProbe()), posterSrc });
    };
    const timeout = window.setTimeout(() => {
      if (metadata) finish(metadata);
      else finish(emptyProbe(), new Error('The media file took too long to read.'));
    }, 12_000);

    video.onloadedmetadata = () => {
      metadata = {
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        durationSeconds: Number.isFinite(video.duration)
          ? video.duration
          : null,
      };
      if (video.readyState >= 2) {
        capture();
        return;
      }
      video.addEventListener('loadeddata', capture, { once: true });
      video.addEventListener('seeked', capture, { once: true });
      try {
        video.currentTime =
          Number.isFinite(video.duration) && video.duration > 0.2
            ? Math.min(0.15, video.duration / 4)
            : 0;
      } catch {
        finish(metadata);
      }
    };
    video.onerror = () =>
      finish(
        metadata || emptyProbe(),
        new Error('That video could not be read.'),
      );
    video.src = source;
  });
}

function emptyProbe(): StudioMediaProbe {
  return { width: null, height: null, durationSeconds: null };
}

export function probeStudioMedia(file: File, explicitMime?: string) {
  const mime = explicitMime || mimeForFile(file);
  const objectUrl = URL.createObjectURL(file);
  const isVideo = kindFromMime(mime) === 'video';
  if (isVideo) {
    return probeVideoSource(objectUrl, { revoke: true });
  }
  return new Promise<StudioMediaProbe>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The media file took too long to read.'));
    }, 12_000);
    const finish = (
      result: StudioMediaProbe,
      error?: Error,
    ) => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      if (error) reject(error);
      else resolve(result);
    };

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

export function probeStudioMediaUrl(url: string, kind: MediaKind) {
  if (kind === 'video') {
    return probeVideoSource(url, { crossOrigin: true });
  }
  return new Promise<StudioMediaProbe>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () =>
      resolve({
        width: image.naturalWidth || null,
        height: image.naturalHeight || null,
        durationSeconds: null,
      });
    image.onerror = () => reject(new Error('That image could not be read.'));
    image.src = url;
  });
}
