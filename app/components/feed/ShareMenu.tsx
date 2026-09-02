'use client';

import { useState } from 'react';
import { DropdownMenu } from 'radix-ui';
import {
  Check,
  Download,
  Facebook,
  Globe,
  Link2,
  Linkedin,
  LoaderCircle,
  Mail,
  MessageCircle,
  MessagesSquare,
  Send,
  Share2,
  Youtube,
} from 'lucide-react';
import type { Video } from '@/lib/types';
import {
  SHARE_TARGETS,
  YOUTUBE_UPLOAD_URL,
  postShareUrl,
  shareDownloadName,
  shareTitle,
  type ShareTargetId,
} from '@/lib/share-targets';
import { cn } from '@/lib/utils';

// Lucide dropped its brand set before X was renamed, so its "Twitter" glyph is
// still the bird. The mark is drawn here rather than shipped wrong.
function XMark(props: { className?: string; 'aria-hidden'?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <path d="M17.53 3h3.13l-6.84 7.82L21.75 21h-5.9l-4.62-6.04L5.94 21H2.8l7.31-8.36L2.5 3h6.05l4.18 5.52L17.53 3Zm-1.1 16.13h1.73L7.65 4.78H5.79l10.64 14.35Z" />
    </svg>
  );
}

const TARGET_ICONS: Record<ShareTargetId, typeof Share2> = {
  x: XMark as unknown as typeof Share2,
  facebook: Facebook,
  linkedin: Linkedin,
  reddit: MessagesSquare,
  telegram: Send,
  whatsapp: MessageCircle,
  weibo: Globe,
  email: Mail,
};

function playableVideoUrl(video: Video) {
  const asset = (video.assets ?? []).find((item) => item.kind === 'video');
  return asset?.url || video.video_url || null;
}

export default function ShareMenu({
  video,
  className,
  label,
}: {
  video: Video;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const payload = {
    url:
      typeof window === 'undefined'
        ? ''
        : postShareUrl(window.location.origin, video.id),
    title: shareTitle(video),
  };
  const videoUrl = playableVideoUrl(video);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(payload.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Your browser blocked the clipboard. Copy the link from the address bar.');
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: payload.title, url: payload.url });
      setOpen(false);
    } catch {
      // The sheet rejects when the reader cancels — nothing to report.
    }
  }

  /**
   * YouTube, TikTok and Reels take an upload, not a link, so the honest share
   * is the file itself. `download` is ignored cross-origin, hence the blob.
   */
  async function downloadVideo(then?: string) {
    if (!videoUrl || downloading) return;
    setDownloading(true);
    setError('');
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error('download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = shareDownloadName(payload.title, videoUrl);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      if (then) window.open(then, '_blank', 'noopener,noreferrer');
      setOpen(false);
    } catch {
      setError('The video could not be downloaded. Try opening the post and saving it.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError('');
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn('share-menu-trigger', className)}
          aria-label={label ?? 'Share'}
        >
          <Share2 aria-hidden="true" />
          {label ? <span>{label}</span> : null}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="share-menu-content"
          align="end"
          sideOffset={6}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenu.Item
            className="share-menu-item"
            onSelect={(event) => {
              event.preventDefault();
              void copyLink();
            }}
          >
            {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
            {copied ? 'Link copied' : 'Copy link'}
          </DropdownMenu.Item>

          {typeof navigator !== 'undefined' && 'share' in navigator ? (
            <DropdownMenu.Item
              className="share-menu-item"
              onSelect={(event) => {
                event.preventDefault();
                void nativeShare();
              }}
            >
              <Share2 aria-hidden="true" />
              Share on this device
            </DropdownMenu.Item>
          ) : null}

          <DropdownMenu.Separator className="share-menu-rule" />
          <DropdownMenu.Label className="share-menu-label">
            Post a link
          </DropdownMenu.Label>
          <div className="share-menu-grid">
            {SHARE_TARGETS.map((target) => {
              const Icon = TARGET_ICONS[target.id];
              return (
                <DropdownMenu.Item key={target.id} asChild>
                  <a
                    className="share-menu-tile"
                    href={target.href(payload)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon aria-hidden="true" />
                    <span>{target.label}</span>
                  </a>
                </DropdownMenu.Item>
              );
            })}
          </div>

          {videoUrl ? (
            <>
              <DropdownMenu.Separator className="share-menu-rule" />
              <DropdownMenu.Label className="share-menu-label">
                Needs the file
              </DropdownMenu.Label>
              <DropdownMenu.Item
                className="share-menu-item"
                disabled={downloading}
                onSelect={(event) => {
                  event.preventDefault();
                  void downloadVideo(YOUTUBE_UPLOAD_URL);
                }}
              >
                {downloading ? (
                  <LoaderCircle className="share-menu-spin" aria-hidden="true" />
                ) : (
                  <Youtube aria-hidden="true" />
                )}
                <span className="share-menu-copy">
                  Upload to YouTube
                  <small>Saves the file, then opens YouTube Studio</small>
                </span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="share-menu-item"
                disabled={downloading}
                onSelect={(event) => {
                  event.preventDefault();
                  void downloadVideo();
                }}
              >
                {downloading ? (
                  <LoaderCircle className="share-menu-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                <span className="share-menu-copy">
                  Download video
                  <small>For TikTok, Reels, and anywhere else</small>
                </span>
              </DropdownMenu.Item>
            </>
          ) : null}

          {error ? (
            <p className="share-menu-error" role="alert">
              {error}
            </p>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
