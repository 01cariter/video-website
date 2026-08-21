'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Film,
  Image as ImageIcon,
  LoaderCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_DIRECT_UPLOAD_BYTES,
  MEDIA_BUCKET,
  extensionFor,
  kindFromMime,
  storagePathFor,
} from '@/lib/media-shared';
import type {
  AppUser,
  Media,
  MediaKind,
  Video,
  VideoCategory,
} from '@/lib/types';
import { MAX_POST_ASSETS, MAX_POST_BODY_LENGTH } from '@/lib/types';
import type { ComposeAssetDraft, ComposeDraft } from './compose/types';

interface MediaUploaderProps {
  user: AppUser;
  initialDraft?: ComposeDraft;
  onPublished: (video: Video) => void;
  onBusyChange?: (busy: boolean) => void;
}

interface Probe {
  kind: MediaKind;
  width: number | null;
  height: number | null;
  duration: number | null;
}

interface SelectionBase {
  key: string;
  objectUrl: string;
  probe: Probe;
}

interface LocalSelection extends SelectionBase {
  source: 'local';
  file: File;
  poster: Blob | null;
}

interface RemoteSelection extends SelectionBase {
  source: 'remote';
  asset: ComposeAssetDraft;
  poster: Blob | null;
}

type Selection = LocalSelection | RemoteSelection;

interface MediaResponse {
  media: Media;
}

interface VideoResponse {
  video: Video;
}

interface AssistQuote {
  credits: number;
  upstreamUsdMicros: number;
  markupBps: number;
  pricingVersion: string;
  modelId: string;
}

interface AssistResponse extends Partial<AssistQuote> {
  title?: string;
  body?: string;
  balance?: number;
  code?: string;
  error?: string;
}

const ACCEPT = Array.from(ALLOWED_MEDIA_MIME_TYPES).join(',');
const POSTER_CAPTURE_TIMEOUT_MS = 8000;

export default function MediaUploader({
  user,
  initialDraft,
  onPublished,
  onBusyChange,
}: MediaUploaderProps) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionsRef = useRef<Selection[]>([]);
  const assistRequestIdRef = useRef<string | null>(null);

  const [selections, setSelections] = useState<Selection[]>(() =>
    selectionsFromDraft(initialDraft),
  );
  const [reading, setReading] = useState(() =>
    draftNeedsHydration(initialDraft),
  );
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState(
    () => initialDraft?.title?.slice(0, 120) ?? '',
  );
  const [body, setBody] = useState(
    () => initialDraft?.body?.slice(0, MAX_POST_BODY_LENGTH) ?? '',
  );
  const [category, setCategory] = useState<VideoCategory>('study');
  const [label, setLabel] = useState('');
  const [stage, setStage] = useState<'idle' | 'uploading' | 'publishing'>(
    'idle',
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [assistQuote, setAssistQuote] = useState<AssistQuote | null>(null);
  const [assistStage, setAssistStage] = useState<
    'idle' | 'quoting' | 'generating' | 'done'
  >('idle');
  const [assistError, setAssistError] = useState('');

  const busy =
    reading || stage !== 'idle' || assistStage === 'generating';

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(
    () => () => {
      onBusyChange?.(false);
    },
    [onBusyChange],
  );

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  useEffect(() => {
    if (!draftNeedsHydration(initialDraft)) return;

    let cancelled = false;
    void hydrateDraftSelections(initialDraft).then(({ items, warnings }) => {
      if (cancelled) {
        for (const item of items) revokeLocalObjectUrl(item);
        return;
      }
      setSelections((current) => {
        for (const item of current) revokeLocalObjectUrl(item);
        return items;
      });
      if (warnings.length > 0) setError(warnings[0]);
      setReading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [initialDraft]);

  const assistContext = useMemo(
    () => ({
      title,
      body,
      imageCount: selections.filter((item) => item.probe.kind === 'image')
        .length,
      videoCount: selections.filter((item) => item.probe.kind === 'video')
        .length,
    }),
    [body, selections, title],
  );
  const assistHasSource = Boolean(title.trim() || body.trim());

  useEffect(() => {
    if (!assistHasSource) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAssistStage((current) =>
        current === 'done' ? current : 'quoting',
      );
      setAssistError('');
      void fetch('/api/compose/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'quote', ...assistContext }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => ({}))) as
            | AssistQuote
            | AssistResponse;
          if (!response.ok || !isAssistQuote(payload)) {
            throw new Error(
              'error' in payload && payload.error
                ? payload.error
                : 'AI fill pricing is unavailable.',
            );
          }
          setAssistQuote(payload);
          setAssistStage((current) =>
            current === 'done' ? current : 'idle',
          );
        })
        .catch((quoteError) => {
          if (controller.signal.aborted) return;
          setAssistQuote(null);
          setAssistStage((current) =>
            current === 'done' ? current : 'idle',
          );
          setAssistError(
            quoteError instanceof Error
              ? quoteError.message
              : 'AI fill pricing is unavailable.',
          );
        });
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [assistContext, assistHasSource]);

  useEffect(
    () => () => {
      for (const item of selectionsRef.current) revokeLocalObjectUrl(item);
    },
    [],
  );

  const removeAt = useCallback((key: string) => {
    setSelections((current) => {
      const next = current.filter((item) => {
        if (item.key !== key) return true;
        revokeLocalObjectUrl(item);
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
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length)
        return current;
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
            setError(
              'Choose JPEG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV files.',
            );
            continue;
          }
          if (file.size <= 0 || file.size > MAX_DIRECT_UPLOAD_BYTES) {
            setError(
              `Files must be between 1 byte and ${formatBytes(MAX_DIRECT_UPLOAD_BYTES)}.`,
            );
            continue;
          }
          const objectUrl = URL.createObjectURL(file);
          try {
            const isVideo = kindFromMime(mime) === 'video';
            const probe = isVideo
              ? await probeVideo(objectUrl)
              : await probeImage(objectUrl);
            const poster = isVideo ? await captureVideoPoster(objectUrl) : null;
            accepted.push({
              source: 'local',
              key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
              file,
              objectUrl,
              probe,
              poster,
            });
          } catch (readError) {
            URL.revokeObjectURL(objectUrl);
            setError(
              readError instanceof Error
                ? readError.message
                : 'That file could not be read.',
            );
          }
        }
        if (accepted.length > 0) {
          setSelections((current) =>
            [...current, ...accepted].slice(0, MAX_POST_ASSETS),
          );
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

  async function fillWithAi() {
    if (!assistQuote || !assistHasSource || busy) return;
    const requestId = assistRequestIdRef.current ?? createRequestId();
    assistRequestIdRef.current = requestId;
    setAssistStage('generating');
    setAssistError('');
    setError('');

    try {
      const response = await fetch('/api/compose/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'generate',
          ...assistContext,
          requestId,
          expectedCredits: assistQuote.credits,
        }),
      });
      let payload: AssistResponse;
      try {
        payload = (await response.json()) as AssistResponse;
      } catch {
        throw new Error(
          'The AI draft response was interrupted. Retry to recover the same request.',
        );
      }
      if (
        !response.ok ||
        typeof payload.title !== 'string' ||
        typeof payload.body !== 'string'
      ) {
        const errorMessage = payload.error;
        if (payload.code === 'PRICE_CHANGED' && isAssistQuote(payload)) {
          setAssistQuote(payload);
        }
        if (!shouldRetainAssistRequest(response, payload)) {
          assistRequestIdRef.current = null;
        }
        throw new Error(errorMessage || 'AI fill could not create a draft.');
      }

      assistRequestIdRef.current = null;
      setTitle(payload.title.slice(0, 120));
      setBody(payload.body.slice(0, MAX_POST_BODY_LENGTH));
      setAssistQuote(null);
      setAssistStage('done');
      window.dispatchEvent(new Event('credits:changed'));
    } catch (assistFailure) {
      setAssistStage('idle');
      setAssistError(
        assistFailure instanceof Error
          ? assistFailure.message
          : 'AI fill failed.',
      );
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!body.trim()) {
      setError('Write something before posting.');
      return;
    }

    setError('');
    const hasLocalSelections = selections.some(
      (item) => item.source === 'local',
    );
    setStage(hasLocalSelections ? 'uploading' : 'publishing');
    setProgress(0);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again.');

      let mediaIds: number[] = [];
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
          if (item.source === 'local') {
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
          } else if (item.poster) {
            jobs.push({
              selectionKey: item.key,
              role: 'cover',
              blob: item.poster,
              mime: item.poster.type || 'image/jpeg',
              path: storagePathFor(
                user.id,
                'poster.jpg',
                item.poster.type || 'image/jpeg',
              ),
              width: item.probe.width,
              height: item.probe.height,
              durationSeconds: null,
            });
          }
        }

        if (jobs.length > 0) {
          const totalBytes =
            jobs.reduce((sum, job) => sum + job.blob.size, 0) || 1;
          const loaded = new Map<string, number>();
          for (const job of jobs) {
            await uploadToStorage({
              blob: job.blob,
              mime: job.mime,
              path: job.path,
              token,
              onProgress: (bytes) => {
                loaded.set(job.path, bytes);
                const sum = [...loaded.values()].reduce(
                  (total, value) => total + value,
                  0,
                );
                setProgress(Math.min(0.98, sum / totalBytes));
              },
            });
            loaded.set(job.path, job.blob.size);
          }
        }

        setProgress(1);
        setStage('publishing');

        const assetBySelection = new Map<string, number>();
        const coverBySelection = new Map<string, number>();
        for (const job of jobs) {
          const media = await registerMedia({
            storagePath: job.path,
            mime: job.mime,
            width: job.width,
            height: job.height,
            durationSeconds: job.durationSeconds,
          });
          if (job.role === 'asset')
            assetBySelection.set(job.selectionKey, media.id);
          else coverBySelection.set(job.selectionKey, media.id);
        }

        for (const item of selections) {
          if (item.source !== 'remote') continue;
          const media = await registerMedia({
            url: item.asset.url,
            kind: item.asset.kind,
            mime: item.asset.mime,
            width: item.probe.width,
            height: item.probe.height,
            durationSeconds: item.probe.duration,
          });
          assetBySelection.set(item.key, media.id);

          if (
            item.probe.kind === 'video' &&
            !item.poster &&
            item.asset.posterUrl &&
            isPublicHttpsUrl(item.asset.posterUrl)
          ) {
            const cover = await registerMedia({
              url: item.asset.posterUrl,
              kind: 'image',
              mime: 'image/jpeg',
              width: item.probe.width,
              height: item.probe.height,
              durationSeconds: null,
            });
            coverBySelection.set(item.key, cover.id);
          }
        }

        mediaIds = selections
          .map((item) => assetBySelection.get(item.key))
          .filter(isNumber);

        const firstImage = selections.find(
          (item) => item.probe.kind === 'image',
        );
        const firstVideo = selections.find(
          (item) => item.probe.kind === 'video',
        );
        if (!firstImage && firstVideo) {
          posterMediaId = coverBySelection.get(firstVideo.key) ?? null;
        }
        if (firstVideo?.probe.duration) {
          durationLabel = formatDuration(firstVideo.probe.duration);
        } else if (selections.every((item) => item.probe.kind === 'image')) {
          durationLabel =
            selections.length === 1 ? 'Photo' : `${selections.length} photos`;
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
      const payload = (await response
        .json()
        .catch(() => ({}))) as VideoResponse & {
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        throw new Error(
          payload.detail || payload.error || 'The post could not be published.',
        );
      }

      onPublished(payload.video);
    } catch (publishError) {
      setError(
        publishError instanceof Error ? publishError.message : 'Upload failed.',
      );
      setStage('idle');
      setProgress(0);
    }
  }

  return (
    <section className="up-shell">
      <form className="up-grid" onSubmit={publish}>
        <div className="up-stage-col">
          <div className="up-section-heading">
            <div>
              <span className="up-eyebrow">Media</span>
              <h2>{selections.length ? 'Selected work' : 'Add media'}</h2>
            </div>
            <span className="up-count">
              {selections.length}/{MAX_POST_ASSETS}
            </span>
          </div>
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
                          poster={
                            item.source === 'remote'
                              ? item.asset.posterUrl || undefined
                              : undefined
                          }
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="up-thumb-media"
                          src={item.objectUrl}
                          alt=""
                        />
                      )}
                      <span className="up-thumb-badge">
                        {isVideo ? (
                          <Film aria-hidden="true" />
                        ) : (
                          <ImageIcon aria-hidden="true" />
                        )}
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
              {reading && (
                <div className="up-loading-note" role="status">
                  <LoaderCircle aria-hidden="true" />
                  Preparing selected canvas media…
                </div>
              )}
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
              <b>
                {reading ? 'Reading files...' : 'Drag photos or videos here'}
              </b>
              <button
                type="button"
                className="up-browse"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                Browse files
              </button>
              <small>
                Up to {MAX_POST_ASSETS} files · photos or video ·{' '}
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
          <div className="up-form-head">
            <div>
              <span className="up-eyebrow">Post details</span>
              <h2>Tell the story</h2>
              <p>Shape the copy, then review everything before publishing.</p>
            </div>
            <button
              type="button"
              className="up-ai"
              onClick={() => void fillWithAi()}
              disabled={!assistQuote || !assistHasSource || busy}
              title={
                !assistHasSource
                  ? 'Add a title or a few source notes first'
                  : assistQuote
                  ? `Uses ${assistQuote.credits} credits`
                  : 'Checking the current AI fill price'
              }
            >
              {assistStage === 'generating' ? (
                <LoaderCircle className="button-spinner" aria-hidden="true" />
              ) : assistStage === 'done' ? (
                <Check aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {assistStage === 'generating'
                ? 'Drafting…'
                : !assistHasSource
                  ? 'Add notes for AI'
                : assistQuote
                  ? `${title.trim() || body.trim() ? 'Refine' : 'Fill'} with AI · ${assistQuote.credits} ${assistQuote.credits === 1 ? 'credit' : 'credits'}`
                  : assistStage === 'quoting'
                    ? 'Checking price…'
                    : 'AI fill unavailable'}
            </button>
          </div>

          {error && (
            <div className="up-error" role="alert">
              {error}
            </div>
          )}

          {assistError && (
            <div className="up-assist-message error" role="alert">
              {assistError}
            </div>
          )}
          {assistStage === 'done' && !assistError && (
            <div className="up-assist-message" role="status">
              <Check aria-hidden="true" />
              AI draft added. Review and edit it before publishing.
            </div>
          )}

          <div className="up-fld">
            <label htmlFor="up-title">
              Title <small>optional</small>
            </label>
            <input
              id="up-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setAssistQuote(null);
                setAssistStage('idle');
                setAssistError('');
              }}
              placeholder="A clear, specific headline"
              maxLength={120}
              disabled={stage !== 'idle' || assistStage === 'generating'}
            />
          </div>

          <div className="up-fld">
            <div className="up-label-row">
              <label htmlFor="up-body">
                Body <small>required</small>
              </label>
              <span>
                {body.length}/{MAX_POST_BODY_LENGTH}
              </span>
            </div>
            <textarea
              id="up-body"
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setAssistQuote(null);
                setAssistStage('idle');
                setAssistError('');
              }}
              placeholder="Add context, process, or the idea behind this work…"
              maxLength={MAX_POST_BODY_LENGTH}
              rows={7}
              required
              disabled={stage !== 'idle' || assistStage === 'generating'}
            />
          </div>

          <div className="up-meta-grid">
            <div className="up-fld">
              <span className="up-label">Category</span>
              <div className="up-seg" role="group" aria-label="Category">
                <button
                  type="button"
                  className={category === 'study' ? 'on' : ''}
                  onClick={() => setCategory('study')}
                  aria-pressed={category === 'study'}
                  disabled={stage !== 'idle'}
                >
                  Study
                </button>
                <button
                  type="button"
                  className={category === 'play' ? 'on' : ''}
                  onClick={() => setCategory('play')}
                  aria-pressed={category === 'play'}
                  disabled={stage !== 'idle'}
                >
                  Play
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
                placeholder="e.g. PROCESS"
                maxLength={24}
                disabled={stage !== 'idle'}
              />
            </div>
          </div>

          {stage !== 'idle' && (
            <div className="up-progress" role="status">
              <span className="up-bar">
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
              </span>
              <small>
                {stage === 'uploading'
                  ? `Uploading ${Math.round(progress * 100)}%`
                  : 'Publishing...'}
              </small>
            </div>
          )}

          <div className="up-submit-area">
            <div>
              <strong>Ready to publish?</strong>
              <small>
                As {user.display_name}
                {selections.length === 0
                  ? ' · text-only post'
                  : ` · ${selections.length} ${selections.length === 1 ? 'asset' : 'assets'}`}
              </small>
            </div>
            <button
              className="up-publish"
              type="submit"
              disabled={!body.trim() || busy}
            >
              {stage !== 'idle' && (
                <LoaderCircle className="button-spinner" aria-hidden="true" />
              )}
              {stage === 'idle' ? 'Publish post' : 'Publishing…'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

async function registerMedia(body: {
  storagePath?: string;
  url?: string;
  kind?: MediaKind;
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
    throw new Error(
      payload.detail || payload.error || 'The upload could not be registered.',
    );
  }
  return payload.media;
}

function selectionsFromDraft(initialDraft?: ComposeDraft): Selection[] {
  return (initialDraft?.assets ?? [])
    .filter(
      (asset) =>
        Boolean(asset.url.trim()) && ALLOWED_MEDIA_MIME_TYPES.has(asset.mime),
    )
    .slice(0, MAX_POST_ASSETS)
    .map((asset, index) => ({
      source: 'remote',
      key: `draft-${index}`,
      objectUrl: asset.url,
      probe: {
        kind: asset.kind,
        width: asset.width ?? null,
        height: asset.height ?? null,
        duration:
          asset.kind === 'video' ? (asset.durationSeconds ?? null) : null,
      },
      asset,
      poster: null,
    }));
}

function draftNeedsHydration(initialDraft?: ComposeDraft) {
  return (initialDraft?.assets ?? []).some(
    (asset) =>
      !isPublicHttpsUrl(asset.url) ||
      Boolean(asset.posterUrl && !isPublicHttpsUrl(asset.posterUrl)),
  );
}

async function hydrateDraftSelections(initialDraft?: ComposeDraft) {
  const items: Selection[] = [];
  const warnings: string[] = [];
  const assets = (initialDraft?.assets ?? [])
    .filter(
      (asset) =>
        Boolean(asset.url.trim()) && ALLOWED_MEDIA_MIME_TYPES.has(asset.mime),
    )
    .slice(0, MAX_POST_ASSETS);

  for (const [index, asset] of assets.entries()) {
    try {
      items.push(await hydrateDraftAsset(asset, index));
    } catch (draftError) {
      warnings.push(
        draftError instanceof Error
          ? draftError.message
          : 'A selected canvas asset could not be prepared.',
      );
    }
  }

  return { items, warnings };
}

async function hydrateDraftAsset(
  asset: ComposeAssetDraft,
  index: number,
): Promise<Selection> {
  if (isPublicHttpsUrl(asset.url)) {
    let poster: Blob | null = null;
    if (asset.posterUrl && !isPublicHttpsUrl(asset.posterUrl)) {
      poster = await fetchDraftBlob(asset.posterUrl, 'image/jpeg');
    }
    return {
      source: 'remote',
      key: `draft-${index}`,
      objectUrl: asset.url,
      asset,
      poster,
      probe: {
        kind: asset.kind,
        width: asset.width ?? null,
        height: asset.height ?? null,
        duration:
          asset.kind === 'video' ? (asset.durationSeconds ?? null) : null,
      },
    };
  }

  const blob = await fetchDraftBlob(asset.url, asset.mime);
  const mime = ALLOWED_MEDIA_MIME_TYPES.has(blob.type) ? blob.type : asset.mime;
  if (!ALLOWED_MEDIA_MIME_TYPES.has(mime)) {
    throw new Error('A selected canvas asset uses an unsupported media type.');
  }
  if (blob.size <= 0 || blob.size > MAX_DIRECT_UPLOAD_BYTES) {
    throw new Error(
      `A selected canvas asset must be under ${formatBytes(MAX_DIRECT_UPLOAD_BYTES)}.`,
    );
  }

  const file = new File(
    [blob],
    `canvas-asset-${index + 1}${extensionFor('', mime)}`,
    { type: mime },
  );
  const objectUrl = URL.createObjectURL(file);
  try {
    const probe =
      kindFromMime(mime) === 'video'
        ? await probeVideo(objectUrl)
        : await probeImage(objectUrl);
    const poster =
      probe.kind === 'video' ? await captureVideoPoster(objectUrl) : null;
    return {
      source: 'local',
      key: `draft-${index}`,
      file,
      objectUrl,
      probe: {
        kind: probe.kind,
        width: probe.width ?? asset.width ?? null,
        height: probe.height ?? asset.height ?? null,
        duration:
          probe.kind === 'video'
            ? (probe.duration ?? asset.durationSeconds ?? null)
            : null,
      },
      poster,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function fetchDraftBlob(url: string, fallbackMime: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('A selected canvas asset is no longer available.');
  }
  const blob = await response.blob();
  if (!blob.type || blob.type === 'application/octet-stream') {
    return new Blob([blob], { type: fallbackMime });
  }
  if (!ALLOWED_MEDIA_MIME_TYPES.has(blob.type)) {
    throw new Error('A selected canvas asset uses an unsupported media type.');
  }
  return blob;
}

function revokeLocalObjectUrl(item: Selection) {
  if (item.source === 'local') URL.revokeObjectURL(item.objectUrl);
}

function isPublicHttpsUrl(value: string) {
  if (value.length > 2048) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isAssistQuote(value: AssistResponse | AssistQuote): value is AssistQuote {
  return (
    typeof value.credits === 'number' &&
    Number.isInteger(value.credits) &&
    value.credits > 0 &&
    typeof value.upstreamUsdMicros === 'number' &&
    typeof value.markupBps === 'number' &&
    typeof value.pricingVersion === 'string' &&
    typeof value.modelId === 'string'
  );
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function shouldRetainAssistRequest(
  response: Response,
  _payload: AssistResponse,
) {
  // PRICE_CHANGED may race with a completed request whose response was lost.
  // Reusing the id lets the next, confirmed retry recover that stored result.
  return response.status === 409;
}

function isNumber(value: number | undefined): value is number {
  return typeof value === 'number';
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
      reject(
        new Error(storageErrorMessage(request.responseText, request.status)),
      );
    };
    request.onerror = () =>
      reject(new Error('The network dropped during upload.'));
    request.onabort = () => reject(new Error('The upload was cancelled.'));
    request.send(blob);
  });
}

function storageErrorMessage(responseText: string, status: number) {
  let detail = '';
  try {
    const parsed = JSON.parse(responseText) as {
      message?: string;
      error?: string;
    };
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
    element.onerror = () =>
      reject(new Error('This browser cannot read that video format.'));
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
    const timer = window.setTimeout(
      () => finish(null),
      POSTER_CAPTURE_TIMEOUT_MS,
    );

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
  if (bytes >= 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
