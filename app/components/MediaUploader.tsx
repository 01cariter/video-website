'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Film,
  Image as ImageIcon,
  LoaderCircle,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_DIRECT_UPLOAD_BYTES,
  MEDIA_BUCKET,
  kindFromMime,
  storagePathFor,
} from '@/lib/media-shared';
import type { AppUser, Media, MediaKind, Video, VideoCategory } from '@/lib/types';
import { MAX_POST_ASSETS, MAX_POST_BODY_LENGTH } from '@/lib/types';

interface MediaUploaderProps {
  user: AppUser;
  onPublished: (video: Video) => void;
}

interface Probe {
  kind: MediaKind;
  width: number | null;
  height: number | null;
  duration: number | null;
}

interface Selection {
  key: string;
  file: File;
  objectUrl: string;
  probe: Probe;
  poster: Blob | null;
}

interface MediaResponse {
  media: Media;
}

interface VideoResponse {
  video: Video;
}

const ACCEPT = Array.from(ALLOWED_MEDIA_MIME_TYPES).join(',');
const POSTER_CAPTURE_TIMEOUT_MS = 8000;

export default function MediaUploader({ user, onPublished }: MediaUploaderProps) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionsRef = useRef<Selection[]>([]);

  const [selections, setSelections] = useState<Selection[]>([]);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<VideoCategory>('study');
  const [label, setLabel] = useState('');
  const [stage, setStage] = useState<'idle' | 'uploading' | 'publishing'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const busy = reading || stage !== 'idle';

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  useEffect(() => () => {
    for (const item of selectionsRef.current) URL.revokeObjectURL(item.objectUrl);
  }, []);

  const removeAt = useCallback((key: string) => {
    setSelections((current) => {
      const next = current.filter((item) => {
        if (item.key !== key) return true;
        URL.revokeObjectURL(item.objectUrl);
        return false;
      });
      return next;
    });
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const move = useCallback((key: string, delta: number) => {
    setSelections((current) => {
      const index = current.findIndex((item) => item.key === key);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }, []);

  const acceptFiles = useCallback(
    async (files: FileList | File[] | null | undefined) => {
      if (!files || busy) return;
      setError('');

      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      const room = MAX_POST_ASSETS - selectionsRef.current.length;
      if (room <= 0) {
        setError(`You can attach up to ${MAX_POST_ASSETS} files.`);
        return;
      }

      setReading(true);
      const accepted: Selection[] = [];
      try {
        for (const file of incoming.slice(0, room)) {
          const mime = file.type || '';
          if (!ALLOWED_MEDIA_MIME_TYPES.has(mime)) {
            setError('Choose JPEG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV files.');
            continue;
          }
          if (file.size <= 0 || file.size > MAX_DIRECT_UPLOAD_BYTES) {
            setError(`Files must be between 1 byte and ${formatBytes(MAX_DIRECT_UPLOAD_BYTES)}.`);
            continue;
          }
          const objectUrl = URL.createObjectURL(file);
          try {
            const isVideo = kindFromMime(mime) === 'video';
            const probe = isVideo ? await probeVideo(objectUrl) : await probeImage(objectUrl);
            const poster = isVideo ? await captureVideoPoster(objectUrl) : null;
            accepted.push({
              key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
              file,
              objectUrl,
              probe,
              poster,
            });
          } catch (readError) {
            URL.revokeObjectURL(objectUrl);
            setError(readError instanceof Error ? readError.message : 'That file could not be read.');
          }
        }
        if (accepted.length > 0) {
          setSelections((current) => [...current, ...accepted].slice(0, MAX_POST_ASSETS));
        }
      } finally {
        setReading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [busy],
  );

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    void acceptFiles(event.target.files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void acceptFiles(event.dataTransfer.files);
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!body.trim()) {
      setError('Write something before posting.');
      return;
    }

    setError('');
    setStage(selections.length > 0 ? 'uploading' : 'publishing');
    setProgress(0);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again.');

      const mediaIds: number[] = [];
      let posterMediaId: number | null = null;
      let durationLabel = '';

      if (selections.length > 0) {
        type Job = {
          selectionKey: string;
          role: 'asset' | 'cover';
          blob: Blob;
          mime: string;
          path: string;
          width: number | null;
          height: number | null;
          durationSeconds: number | null;
        };
        const jobs: Job[] = [];
        for (const item of selections) {
          const isVideo = item.probe.kind === 'video';
          jobs.push({
            selectionKey: item.key,
            role: 'asset',
            blob: item.file,
            mime: item.file.type,
            path: storagePathFor(user.id, item.file.name, item.file.type),
            width: item.probe.width,
            height: item.probe.height,
            durationSeconds: isVideo ? item.probe.duration : null,
          });
          if (isVideo && item.poster) {
            jobs.push({
              selectionKey: item.key,
              role: 'cover',
              blob: item.poster,
              mime: 'image/jpeg',
              path: storagePathFor(user.id, 'poster.jpg', 'image/jpeg'),
              width: item.probe.width,
              height: item.probe.height,
              durationSeconds: null,
            });
          }
        }

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

        const coverBySelection = new Map<string, number>();
        for (const job of jobs) {
          const media = await registerMedia({
            storagePath: job.path,
            mime: job.mime,
            width: job.width,
            height: job.height,
            durationSeconds: job.durationSeconds,
          });
          if (job.role === 'asset') mediaIds.push(media.id);
          else coverBySelection.set(job.selectionKey, media.id);
        }

        const firstImage = selections.find((item) => item.probe.kind === 'image');
        const firstVideo = selections.find((item) => item.probe.kind === 'video');
        if (!firstImage && firstVideo) {
          posterMediaId = coverBySelection.get(firstVideo.key) ?? null;
        }
        if (firstVideo?.probe.duration) {
          durationLabel = formatDuration(firstVideo.probe.duration);
        } else if (selections.every((item) => item.probe.kind === 'image')) {
          durationLabel = selections.length === 1 ? 'Photo' : `${selections.length} photos`;
        }
      }

      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          description: body.trim(),
          category,
          label: label.trim(),
          mediaIds,
          posterMediaId,
          duration: durationLabel,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as VideoResponse & {
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || 'The post could not be published.');
      }

      onPublished(payload.video);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Upload failed.');
      setStage('idle');
      setProgress(0);
    }
  }

  return (
    <section className="up-shell">
      <form className="up-grid" onSubmit={publish}>
        <div className="up-stage-col">
          {selections.length > 0 ? (
            <div className="up-multi">
              <ul className="up-thumbs">
                {selections.map((item, index) => {
                  const isVideo = item.probe.kind === 'video';
                  return (
                    <li key={item.key} className="up-thumb">
                      {isVideo ? (
                        <video
                          className="up-thumb-media"
                          src={item.objectUrl}
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="up-thumb-media" src={item.objectUrl} alt="" />
                      )}
                      <span className="up-thumb-badge">
                        {isVideo ? <Film aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}
                        {index + 1}
                      </span>
                      <div className="up-thumb-actions">
                        <button
                          type="button"
                          onClick={() => move(item.key, -1)}
                          disabled={busy || index === 0}
                          aria-label="Move earlier"
                        >
                          <ChevronLeft aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(item.key, 1)}
                          disabled={busy || index === selections.length - 1}
                          aria-label="Move later"
                        >
                          <ChevronRight aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAt(item.key)}
                          disabled={busy}
                          aria-label="Remove"
                        >
                          <X aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {selections.length < MAX_POST_ASSETS && (
                <button
                  type="button"
                  className="up-add-more"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                >
                  Add more ({selections.length}/{MAX_POST_ASSETS})
                </button>
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
              <b>{reading ? 'Reading files...' : 'Drag photos or videos here'}</b>
              <button
                type="button"
                className="up-browse"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                Browse files
              </button>
              <small>
                Optional · up to {MAX_POST_ASSETS} files · JPEG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV ·{' '}
                {formatBytes(MAX_DIRECT_UPLOAD_BYTES)} each
              </small>
            </div>
          )}
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept={ACCEPT}
            multiple
            onChange={onPick}
            tabIndex={-1}
          />
        </div>

        <div className="up-form">
          <h2>New post</h2>

          {error && <div className="up-error" role="alert">{error}</div>}

          <div className="up-fld">
            <label htmlFor="up-body">
              Body <small>required</small>
            </label>
            <textarea
              id="up-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What's happening?"
              maxLength={MAX_POST_BODY_LENGTH}
              rows={5}
              required
            />
          </div>

          <div className="up-fld">
            <label htmlFor="up-title">
              Title <small>optional</small>
            </label>
            <input
              id="up-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Short headline"
              maxLength={120}
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
            <label htmlFor="up-label">
              Badge <small>optional</small>
            </label>
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

          <button className="up-publish" type="submit" disabled={!body.trim() || busy}>
            {stage !== 'idle' && <LoaderCircle className="button-spinner" aria-hidden="true" />}
            {stage === 'idle' ? 'Publish to feed' : 'Working...'}
          </button>
          <small className="up-hint">
            Posted as {user.display_name}
            {selections.length === 0 ? ' · text-only is fine' : ` · ${selections.length} media attached`}.
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
      console.error('[snackd] storage upload rejected', {
        status: request.status,
        endpoint,
        path,
        mime,
        body: request.responseText,
      });
      reject(new Error(storageErrorMessage(request.responseText, request.status)));
    };
    request.onerror = () => reject(new Error('The network dropped during upload.'));
    request.onabort = () => reject(new Error('The upload was cancelled.'));
    request.send(blob);
  });
}

function storageErrorMessage(responseText: string, status: number) {
  let detail = '';
  try {
    const parsed = JSON.parse(responseText) as { message?: string; error?: string };
    detail = String(parsed.message || parsed.error || '');
  } catch {
    detail = responseText.trim().slice(0, 200);
  }
  return detail
    ? `Storage rejected the upload (HTTP ${status}): ${detail}`
    : `Storage rejected the upload (HTTP ${status}).`;
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

function formatDuration(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
