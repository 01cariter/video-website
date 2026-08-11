'use client';

import { useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Send,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { AppUser, Comment, Video, VideoAsset } from '@/lib/types';
import { postHeadline } from '@/lib/post-text';
import { bg, fmtDate, fmtLikes, initials, profileHref } from './media';

interface MediaPreviewProps {
  video: Video;
  user: AppUser | null;
  index: number;
  total: number;
  direction: number;
  comments: Comment[];
  commentsLoading: boolean;
  commentsError: boolean;
  draft: string;
  posting: boolean;
  shared: boolean;
  onClose: () => void;
  onNavigate: (delta: number) => void;
  onLike: (video: Video) => void;
  onSave: (video: Video) => void;
  onFollow: (video: Video) => void;
  onShare: (video: Video) => void;
  onDraftChange: (value: string) => void;
  onComment: (event: FormEvent<HTMLFormElement>) => void;
  onRetryComments: () => void;
  onNeedAuth: () => void;
  standalone?: boolean;
}

interface PlaybackStageProps {
  video: Video;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function resolveAssets(video: Video): VideoAsset[] {
  if (video.assets?.length) return video.assets;
  if (video.video_url) {
    return [{
      media_id: 0,
      kind: 'video',
      mime: video.video_mime || 'video/mp4',
      url: video.video_url,
      width: video.video_w,
      height: video.video_h,
      duration_seconds: null,
      position: 0,
    }];
  }
  if (video.poster_url) {
    return [{
      media_id: 0,
      kind: 'image',
      mime: 'image/jpeg',
      url: video.poster_url,
      width: video.poster_w,
      height: video.poster_h,
      duration_seconds: null,
      position: 0,
    }];
  }
  return [];
}

function PlaybackStage({ video }: PlaybackStageProps) {
  const assets = resolveAssets(video);
  const [assetIndex, setAssetIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const asset = assets[Math.min(assetIndex, Math.max(assets.length - 1, 0))];
  const isVideo = asset?.kind === 'video' && Boolean(asset.url);
  const [playing, setPlaying] = useState(isVideo);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  async function togglePlayback() {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) await element.play();
    else element.pause();
  }

  function toggleMute() {
    const element = videoRef.current;
    if (!element) return;
    element.muted = !element.muted;
    setMuted(element.muted);
  }

  function seek(event: MouseEvent<HTMLButtonElement>) {
    const element = videoRef.current;
    if (!element || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    element.currentTime = ((event.clientX - rect.left) / rect.width) * duration;
  }

  return (
    <section className="pv-stage">
      {isVideo && asset.url && (
        <video
          key={`${video.id}-${asset.media_id}-${assetIndex}`}
          ref={videoRef}
          className="pv-video"
          src={asset.url}
          poster={video.poster_url || undefined}
          autoPlay
          loop
          muted
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        />
      )}

      {!isVideo && asset?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pv-video" src={asset.url} alt="" />
      )}

      {!isVideo && !asset?.url && (
        <div
          className="pv-video"
          style={{ background: bg(null, video.category, assetIndex) }}
          aria-hidden="true"
        />
      )}

      {assets.length > 1 && (
        <>
          <button
            type="button"
            className="pv-asset-nav prev"
            disabled={assetIndex <= 0}
            onClick={() => setAssetIndex((current) => Math.max(0, current - 1))}
            aria-label="Previous media"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pv-asset-nav next"
            disabled={assetIndex >= assets.length - 1}
            onClick={() => setAssetIndex((current) => Math.min(assets.length - 1, current + 1))}
            aria-label="Next media"
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <span className="pv-asset-count">
            {assetIndex + 1}/{assets.length}
          </span>
        </>
      )}

      {isVideo && (
        <div className="pv-controls">
          <button type="button" onClick={() => void togglePlayback()} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <span>{formatTime(currentTime)}</span>
          <button type="button" className="pv-track" onClick={seek} aria-label="Seek video">
            <i style={{ width: `${progress}%` }} />
          </button>
          <span>{formatTime(duration)}</span>
          <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </button>
        </div>
      )}
    </section>
  );
}

function AuthorIdentity({ video }: { video: Video }) {
  const identity = (
    <>
      <span className="av" style={{ background: video.author_color }}>
        {initials(video.author_name)}
      </span>
      <span className="who">
        <b>{video.author_name}</b>
        <small>{video.author_handle} · {fmtLikes(video.author_followers)} followers</small>
      </span>
    </>
  );

  const href = profileHref(video.author_handle);
  if (!href) return <span className="pv-who">{identity}</span>;
  return (
    <Link className="pv-who" href={href} title={`View ${video.author_name}'s profile`}>
      {identity}
    </Link>
  );
}

function timeAgo(timestamp: string) {
  const seconds = (Date.now() - new Date(timestamp).getTime()) / 1000;
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function MediaPreview({
  video,
  user,
  index,
  total,
  direction,
  comments = [],
  commentsLoading,
  commentsError,
  draft,
  posting,
  shared,
  onClose,
  onNavigate,
  onLike,
  onSave,
  onFollow,
  onShare,
  onDraftChange,
  onComment,
  onRetryComments,
  onNeedAuth,
  standalone = false,
}: MediaPreviewProps) {
  return (
    <div
      className={`pv-backdrop ${standalone ? 'pv-standalone' : ''}`}
      onClick={standalone ? undefined : onClose}
    >
      <aside className="pv-utility" aria-label="Viewer controls">
        <button
          type="button"
          className="pv-back"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          title="Back to feed"
          aria-label="Back to feed"
        >
          <ArrowLeft aria-hidden="true" />
          <span>Back</span>
        </button>

        {!standalone && total > 1 && (
          <div className="pv-switcher" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => onNavigate(-1)}
              aria-label="Previous post"
            >
              <ChevronUp aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={index >= total - 1}
              onClick={() => onNavigate(1)}
              aria-label="Next post"
            >
              <ChevronDown aria-hidden="true" />
            </button>
          </div>
        )}
      </aside>

      <div className="pv-shell">
        <div
          key={video.id}
          className={`pv-content ${
            direction > 0 ? 'pv-content-next' : direction < 0 ? 'pv-content-prev' : ''
          }`}
          onClick={(event) => event.stopPropagation()}
        >
            <PlaybackStage key={video.id} video={video} />

            <aside className="pv-panel">
              <section className="pv-author">
                <AuthorIdentity video={video} />
                {user?.id === video.author_id ? (
                  <span className="own">YOU</span>
                ) : (
                  <button
                    type="button"
                    className={`followBtn ${video.following ? 'on' : ''}`}
                    onClick={() => onFollow(video)}
                  >
                    {video.following ? 'Following' : 'Follow'}
                  </button>
                )}
              </section>

              <section className="pv-details">
                <div className="pv-detail-meta">
                  <span>{video.label || (video.category === 'study' ? 'Study' : 'Entertainment')}</span>
                  <span>{video.duration}</span>
                  <span>{fmtLikes(video.views_count)} views</span>
                  <span>Uploaded {fmtDate(video.created_at)}</span>
                </div>
                {video.title?.trim() ? <h2>{video.title.trim()}</h2> : <h2>{postHeadline(video)}</h2>}
                <p>{video.description || 'No description yet.'}</p>
              </section>

              <section className="pv-actions">
                <button
                  type="button"
                  className={video.liked ? 'on like' : ''}
                  onClick={() => onLike(video)}
                  aria-label={video.liked ? 'Unlike' : 'Like'}
                >
                  <Heart aria-hidden="true" />
                  <span>{fmtLikes(video.likes_count)}</span>
                </button>
                <button
                  type="button"
                  className={video.saved ? 'on save' : ''}
                  onClick={() => onSave(video)}
                  aria-label={video.saved ? 'Remove from saved' : 'Save'}
                >
                  <Bookmark aria-hidden="true" />
                  <span>{fmtLikes(video.saves_count)}</span>
                </button>
                <button type="button" onClick={() => onShare(video)} aria-label="Share">
                  <Share2 aria-hidden="true" />
                  <span>{shared ? 'Copied' : 'Share'}</span>
                </button>
              </section>

              <section className="pv-comments">
                <header>
                  <b>Comments</b>
                  <span>{video.comments_count}</span>
                </header>
                <div className="clist">
                  {commentsLoading && (
                    <div className="comment-skeletons" role="status" aria-label="Loading comments">
                      <span className="sr-only">Loading comments</span>
                      {[0, 1, 2].map((item) => (
                        <div className="comment-skeleton" aria-hidden="true" key={item}>
                          <i />
                          <span>
                            <b />
                            <b />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!commentsLoading && commentsError && (
                    <div className="comments-empty">
                      <MessageCircle aria-hidden="true" />
                      <p>Comments could not load.</p>
                      <button type="button" onClick={onRetryComments}>Retry</button>
                    </div>
                  )}
                  {!commentsLoading && !commentsError && comments.length === 0 && (
                    <div className="comments-empty">
                      <MessageCircle aria-hidden="true" />
                      <p>Start the conversation.</p>
                    </div>
                  )}
                  {comments.map((comment) => (
                    <article className="citem" key={comment.id}>
                      <span className="cav" style={{ background: comment.author_color }}>
                        {initials(comment.author_name)}
                      </span>
                      <div className="cbody">
                        <b>{comment.author_name} <small>{timeAgo(comment.created_at)}</small></b>
                        <p>{comment.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {user ? (
                <form className="cform" onSubmit={onComment}>
                  <input
                    value={draft}
                    onChange={(event) => onDraftChange(event.target.value)}
                    placeholder="Add a comment..."
                    maxLength={1000}
                  />
                  <button type="submit" disabled={!draft.trim() || posting} aria-label="Post comment">
                    <Send aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <div className="cform-guest">
                  <div>
                    <b>Join the conversation</b>
                    <p>Sign in to leave a comment.</p>
                  </div>
                  <button type="button" onClick={onNeedAuth}>
                    Sign in
                  </button>
                </div>
              )}
            </aside>
        </div>
      </div>
    </div>
  );
}
