'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CloudUpload, Film, Image as ImageIcon, LoaderCircle, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_DIRECT_UPLOAD_BYTES,
  MEDIA_BUCKET,
  kindFromMime,
  storagePathFor,
} from '@/lib/media-shared';
import type { AppUser, MediaKind, Media, VideoCategory } from '@/lib/types';

interface MediaUploaderProps {
  user: AppUser;
}

interface Probe {
  kind: MediaKind;
  width: number | null;
  height: number | null;
  duration: number | null;
}

interface Selection {
  file: File;
  objectUrl: string;
  probe: Probe;
  poster: Blob | null;
}

interface MediaResponse {
  media: Media;
}

interface VideoResponse {
  video: { id: number };
}

const ACCEPT = Array.from(ALLOWED_MEDIA_MIME_TYPES).join(',');
const POSTER_CAPTURE_TIMEOUT_MS = 8000;

export default function MediaUploader({ user }: MediaUploaderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<Selection | null>(null);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<VideoCategory>('study');
  const [label, setLabel] = useState('');
  const [stage, setStage] = useState<'idle' | 'uploading' | 'publishing'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const busy = reading || stage !== 'idle';

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  // Release the last preview URL if the user leaves without publishing.
  useEffect(() => () => {
    if (selectionRef.current) URL.revokeObjectURL(selectionRef.current.objectUrl);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection((current) => {
      if (current) URL.revokeObjectURL(current.objectUrl);
      return null;
    });
    setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const accept = useCallback(
    async (file: File | undefined) => {
      if (!file || busy) return;
      setError('');

      const mime = file.type || '';
      if (!ALLOWED_MEDIA_MIME_TYPES.has(mime)) {
        setError('Choose a JPEG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV file.');
        return;
      }
      if (file.size <= 0 || file.size > MAX_DIRECT_UPLOAD_BYTES) {
        setError(`Files must be between 1 byte and ${formatBytes(MAX_DIRECT_UPLOAD_BYTES)}.`);
        return;
      }

      clearSelection();
      setReading(true);
      const objectUrl = URL.createObjectURL(file);
      try {
        const isVideo = kindFromMime(mime) === 'video';
        const probe = isVideo ? await probeVideo(objectUrl) : await probeImage(objectUrl);
        const poster = isVideo ? await captureVideoPoster(objectUrl) : file;
        setSelection({ file, objectUrl, probe, poster });
        setTitle((current) => current || titleFromFileName(file.name));
      } catch (readError) {
        URL.revokeObjectURL(objectUrl);
        setError(readError instanceof Error ? readError.message : 'That file could not be read.');
      } finally {
        setReading(false);
      }
    },
    [busy, clearSelection],
  );

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    void accept(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void accept(event.dataTransfer.files?.[0]);
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || busy) return;
    if (!title.trim()) {
      setError('Give your post a title.');
      return;
    }

    setError('');
    setStage('uploading');
    setProgress(0);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again.');

      const { file, probe, poster } = selection;
      const isVideo = probe.kind === 'video';

      const jobs: Array<{ role: 'poster' | 'video'; blob: Blob; mime: string; path: string }> = [];
      if (poster) {
        const posterMime = isVideo ? 'image/jpeg' : file.type;
        jobs.push({
          role: 'poster',
          blob: poster,
          mime: posterMime,
          path: storagePathFor(user.id, isVideo ? 'poster.jpg' : file.name, posterMime),
        });
      }
      if (isVideo) {
        jobs.push({
          role: 'video',
          blob: file,
          mime: file.type,
          path: storagePathFor(user.id, file.name, file.type),
        });
      }

      // Push every object to Storage first so a mid-flight failure never leaves
      // a half-built post behind — only orphaned bytes.
      const totalBytes = jobs.reduce((sum, job) => sum + job.blob.size, 0) || 1;
      const loaded = new Map<string, number>();
      for (const job of jobs) {
        await uploadToStorage({
          blob: job.blob,
          mime: job.mime,
          path: job.path,
          token,
          onProgress: (bytes) => {
            loaded.set(job.path, bytes);
            const sum = [...loaded.values()].reduce((total, value) => total + value, 0);
            setProgress(Math.min(0.98, sum / totalBytes));
          },
        });
        loaded.set(job.path, job.blob.size);
      }

      setProgress(1);
      setStage('publishing');

      let posterMediaId: number | null = null;
      let videoMediaId: number | null = null;
      for (const job of jobs) {
        const media = await registerMedia({
          storagePath: job.path,
          mime: job.mime,
          width: probe.width,
          height: probe.height,
          durationSeconds: job.role === 'video' ? probe.duration : null,
        });
        if (job.role === 'poster') posterMediaId = media.id;
        else videoMediaId = media.id;
      }

      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          label: label.trim(),
          posterMediaId,
          videoMediaId,
          duration: isVideo ? formatDuration(probe.duration) : 'Photo',
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as VideoResponse & {
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || 'The post could not be published.');
      }

      router.push(`/videos/${payload.video.id}`);
      router.refresh();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Upload failed.');
      setStage('idle');
      setProgress(0);
    }
  }

  const isVideoSelection = selection?.probe.kind === 'video';

  return (
    <section className="up-shell">
      <form className="up-grid" onSubmit={publish}>
        <div className="up-stage-col">
          {selection ? (
            <div className="up-preview">
              {isVideoSelection ? (
                <video
                  className="up-preview-media"
                  src={selection.objectUrl}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="up-preview-media" src={selection.objectUrl} alt="Selected upload" />
              )}
              <button
                type="button"
                className="up-clear"
                onClick={clearSelection}
                disabled={busy}
                title="Remove file"
                aria-label="Remove file"
              >
                <X aria-hidden="true" />
              </button>
              <ul className="up-facts">
                <li>
                  {isVideoSelection ? <Film aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}
                  {isVideoSelection ? 'Video' : 'Photo'}
                </li>
                {selection.probe.width && selection.probe.height && (
                  <li>{selection.probe.width} × {selection.probe.height}</li>
                )}
                {isVideoSelection && <li>{formatDuration(selection.probe.duration)}</li>}
                <li>{formatBytes(selection.file.size)}</li>
              </ul>
              {isVideoSelection && !selection.poster && (
                <p className="up-note">
                  No cover frame could be grabbed from this clip. It will use a colour placeholder.
                </p>
              )}
            </div>
          ) : (
            <div
              className={`up-drop ${dragging ? 'on' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {reading ? (
                <LoaderCircle className="up-drop-spinner" aria-hidden="true" />
              ) : (
                <CloudUpload aria-hidden="true" />
              )}
              <b>{reading ? 'Reading file...' : 'Drag a photo or video here'}</b>
              <button
                type="button"
                className="up-browse"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                Browse files
              </button>
              <small>
                JPEG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV · up to {formatBytes(MAX_DIRECT_UPLOAD_BYTES)}
              </small>
            </div>
          )}
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept={ACCEPT}
            onChange={onPick}
            tabIndex={-1}
          />
        </div>

        <div className="up-form">
          <h2>Post details</h2>

          {error && <div className="up-error" role="alert">{error}</div>}

          <div className="up-fld">
            <label htmlFor="up-title">Title</label>
            <input
              id="up-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Fractions in 60s"
              maxLength={120}
              required
            />
          </div>

          <div className="up-fld">
            <label htmlFor="up-description">Description</label>
            <textarea
              id="up-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this short about?"
              maxLength={2000}
              rows={4}
            />
          </div>

          <div className="up-fld">
            <span className="up-label">Category</span>
            <div className="up-seg" role="group" aria-label="Category">
              <button
                type="button"
                className={category === 'study' ? 'on' : ''}
                onClick={() => setCategory('study')}
                aria-pressed={category === 'study'}
              >
                Study
              </button>
              <button
                type="button"
                className={category === 'play' ? 'on' : ''}
                onClick={() => setCategory('play')}
                aria-pressed={category === 'play'}
              >
                Entertainment
              </button>
            </div>
          </div>

          <div className="up-fld">
            <label htmlFor="up-label">Badge <small>optional</small></label>
            <input
              id="up-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="SPORTS"
              maxLength={24}
            />
          </div>

          {stage !== 'idle' && (
            <div className="up-progress" role="status">
              <span className="up-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></span>
              <small>
                {stage === 'uploading'
                  ? `Uploading ${Math.round(progress * 100)}%`
                  : 'Publishing...'}
              </small>
            </div>
          )}

          <button className="up-publish" type="submit" disabled={!selection || busy}>
            {stage !== 'idle' && <LoaderCircle className="button-spinner" aria-hidden="true" />}
            {stage === 'idle' ? 'Publish to feed' : 'Working...'}
          </button>
          <small className="up-hint">
            Posted as {user.display_name} · files go straight to your Supabase Storage folder.
          </small>
        </div>
      </form>
    </section>
  );
}

async function registerMedia(body: {
  storagePath: string;
  mime: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}) {
  const response = await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as MediaResponse & {
    error?: string;
    detail?: string;
  };
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || 'The upload could not be registered.');
  }
  return payload.media;
}

// XHR rather than supabase-js: the storage client gives no upload progress, and
// a 50 MB clip needs a real progress bar.
function uploadToStorage({
  blob,
  mime,
  path,
  token,
  onProgress,
}: {
  blob: Blob;
  mime: string;
  path: string;
  token: string;
  onProgress: (bytes: number) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const endpoint = `${getSupabaseUrl()}/storage/v1/object/${MEDIA_BUCKET}/${path}`;
    const request = new XMLHttpRequest();
    request.open('POST', endpoint);
    request.setRequestHeader('authorization', `Bearer ${token}`);
    request.setRequestHeader('apikey', getSupabasePublishableKey());
    request.setRequestHeader('content-type', mime);
    request.setRequestHeader('cache-control', 'max-age=31536000');
    request.setRequestHeader('x-upsert', 'false');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      reject(new Error(storageErrorMessage(request.responseText, request.status)));
    };
    request.onerror = () => reject(new Error('The network dropped during upload.'));
    request.onabort = () => reject(new Error('The upload was cancelled.'));
    request.send(blob);
  });
}

function storageErrorMessage(responseText: string, status: number) {
  try {
    const parsed = JSON.parse(responseText) as { message?: string; error?: string };
    if (parsed.message || parsed.error) return String(parsed.message || parsed.error);
  } catch {
    // Storage returned a non-JSON body.
  }
  return `Storage rejected the upload (HTTP ${status}).`;
}

function probeImage(objectUrl: string) {
  return new Promise<Probe>((resolve, reject) => {
    const image = document.createElement('img');
    image.onload = () =>
      resolve({
        kind: 'image',
        width: image.naturalWidth || null,
        height: image.naturalHeight || null,
        duration: null,
      });
    image.onerror = () => reject(new Error('That image could not be read.'));
    image.src = objectUrl;
  });
}

function probeVideo(objectUrl: string) {
  return new Promise<Probe>((resolve, reject) => {
    const element = document.createElement('video');
    element.preload = 'metadata';
    element.muted = true;
    element.onloadedmetadata = () =>
      resolve({
        kind: 'video',
        width: element.videoWidth || null,
        height: element.videoHeight || null,
        duration: Number.isFinite(element.duration) ? element.duration : null,
      });
    element.onerror = () => reject(new Error('This browser cannot read that video format.'));
    element.src = objectUrl;
  });
}

// Grabs an early frame as the feed cover. Resolves null when the browser cannot
// decode the codec (common for MOV outside Safari) — the post still publishes.
function captureVideoPoster(objectUrl: string) {
  return new Promise<Blob | null>((resolve) => {
    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(blob);
    };
    const timer = window.setTimeout(() => finish(null), POSTER_CAPTURE_TIMEOUT_MS);

    const element = document.createElement('video');
    element.preload = 'auto';
    element.muted = true;
    element.playsInline = true;
    element.onerror = () => finish(null);
    element.onloadeddata = () => {
      const duration = Number.isFinite(element.duration) ? element.duration : 1;
      element.currentTime = Math.min(0.6, Math.max(0, duration - 0.05));
    };
    element.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) {
          finish(null);
          return;
        }
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.82);
      } catch {
        finish(null);
      }
    };
    element.src = objectUrl;
  });
}

function titleFromFileName(name: string) {
  return name
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 120);
}

function formatDuration(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
