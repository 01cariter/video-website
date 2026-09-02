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
import { avatarStyle, bg, fmtDate, fmtLikes, initials, profileHref } from './media';
import CollectionChip from './feed/CollectionChip';
import DeleteMenu from './feed/DeleteMenu';
import ShareMenu from './feed/ShareMenu';
import { useT } from './i18n-provider';

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
  onClose: () => void;
  onNavigate: (delta: number) => void;
  onLike: (video: Video) => void;
  onSave: (video: Video) => void;
  onFollow: (video: Video) => void;
  onDeletePost: (video: Video) => Promise<void>;
  onDeleteComment: (comment: Comment) => Promise<void>;
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
  const t = useT();
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
        <img className="pv-video" src={asset.url} alt="" decoding="async" />
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
            aria-label={t('viewer.previousMedia')}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pv-asset-nav next"
            disabled={assetIndex >= assets.length - 1}
            onClick={() => setAssetIndex((current) => Math.min(assets.length - 1, current + 1))}
            aria-label={t('viewer.nextMedia')}
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
          <button type="button" onClick={() => void togglePlayback()} aria-label={playing ? t('viewer.pause') : t('viewer.play')}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <span>{formatTime(currentTime)}</span>
          <button type="button" className="pv-track" onClick={seek} aria-label={t('viewer.seek')}>
            <i style={{ width: `${progress}%` }} />
          </button>
          <span>{formatTime(duration)}</span>
          <button type="button" onClick={toggleMute} aria-label={muted ? t('viewer.unmute') : t('viewer.mute')}>
            {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </button>
        </div>
      )}
    </section>
  );
}

function AuthorIdentity({
  video,
  onNavigate,
}: {
  video: Video;
  onNavigate: () => void;
}) {
  const identity = (
    <>
      <span className="av" style={avatarStyle(video.author_color, video.author_avatar)}>
        {initials(video.author_name)}
      </span>
      <span className="who">
        <b>{video.author_name}</b>
        <small>
          {video.author_handle} ·{' '}
          <span className="tabular-nums">{fmtLikes(video.author_followers)}</span>{' '}
          followers
        </small>
      </span>
    </>
  );

  const href = profileHref(video.author_handle);
  if (!href) return <span className="pv-who">{identity}</span>;
  return (
    <Link
      className="pv-who"
      href={href}
      title={video.author_name}
      onClick={onNavigate}
    >
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
  onClose,
  onNavigate,
  onLike,
  onSave,
  onFollow,
  onDeletePost,
  onDeleteComment,
  onDraftChange,
  onComment,
  onRetryComments,
  onNeedAuth,
  standalone = false,
}: MediaPreviewProps) {
  const t = useT();
  return (
    <div
      className={`pv-backdrop ${standalone ? 'pv-standalone' : ''}`}
      onClick={standalone ? undefined : onClose}
    >
      <aside className="pv-utility" aria-label={t('viewer.controls')}>
        <button
          type="button"
          className="pv-back"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          title={t('viewer.backToFeed')}
          aria-label={t('viewer.backToFeed')}
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
              aria-label={t('viewer.previousPost')}
            >
              <ChevronUp aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={index >= total - 1}
              onClick={() => onNavigate(1)}
              aria-label={t('viewer.nextPost')}
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
                <AuthorIdentity video={video} onNavigate={onClose} />
                {user?.id === video.author_id ? (
                  <span className="own">{t('post.you')}</span>
                ) : (
                  <button
                    type="button"
                    className={`followBtn ${video.following ? 'on' : ''}`}
                    onClick={() => onFollow(video)}
                  >
                    {video.following ? t('post.followingState') : t('post.follow')}
                  </button>
                )}
              </section>

              <section className="pv-details">
                <CollectionChip video={video} />
                <div className="pv-detail-meta">
                  <span>{video.label || (video.category === 'study' ? t('common.study') : t('common.play'))}</span>
                  <span className="tabular-nums">{video.duration}</span>
                  <span>{t('post.views', { count: fmtLikes(video.views_count) })}</span>
                  <span>{t('post.uploaded', { date: fmtDate(video.created_at) })}</span>
                </div>
                {video.title?.trim() ? <h2>{video.title.trim()}</h2> : <h2>{postHeadline(video)}</h2>}
                <p>{video.description || t('post.noDescription')}</p>
              </section>

              <section className="pv-actions">
                <button
                  type="button"
                  className={video.liked ? 'on like' : ''}
                  onClick={() => onLike(video)}
                  aria-label={video.liked ? t('post.unlike') : t('post.like')}
                >
                  <Heart aria-hidden="true" />
                  <span className="tabular-nums">
                    {fmtLikes(video.likes_count)}
                  </span>
                </button>
                <button
                  type="button"
                  className={video.saved ? 'on save' : ''}
                  onClick={() => onSave(video)}
                  aria-label={video.saved ? t('post.unsave') : t('post.save')}
                >
                  <Bookmark aria-hidden="true" />
                  <span className="tabular-nums">
                    {fmtLikes(video.saves_count)}
                  </span>
                </button>
                <ShareMenu video={video} label={t('post.share')} />
                {user?.id === video.author_id && (
                  <DeleteMenu
                    itemLabel="post"
                    className="pv-post-menu"
                    video={video}
                    onDelete={() => onDeletePost(video)}
                  />
                )}
              </section>

              <section className="pv-comments">
                <header>
                  <b>{t('comment.title')}</b>
                  <span className="tabular-nums">{video.comments_count}</span>
                </header>
                <div className="clist">
                  {commentsLoading && (
                    <div className="comment-skeletons" role="status" aria-label={t('comment.loading')}>
                      <span className="sr-only">{t('comment.loading')}</span>
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
                      <p>{t('comment.loadFailed')}</p>
                      <button type="button" onClick={onRetryComments}>{t('common.retry')}</button>
                    </div>
                  )}
                  {!commentsLoading && !commentsError && comments.length === 0 && (
                    <div className="comments-empty">
                      <MessageCircle aria-hidden="true" />
                      <p>{t('comment.start')}</p>
                    </div>
                  )}
                  {comments.map((comment) => {
                    const authorHref = profileHref(comment.author_handle);
                    const avatar = (
                      <span
                        className="cav"
                        style={avatarStyle(comment.author_color, comment.author_avatar)}
                        aria-hidden="true"
                      >
                        {initials(comment.author_name)}
                      </span>
                    );
                    return (
                      <article className="citem" key={comment.id}>
                        {authorHref ? (
                          <Link
                            href={authorHref}
                            className="citem-av"
                            onClick={onClose}
                            tabIndex={-1}
                            aria-hidden="true"
                          >
                            {avatar}
                          </Link>
                        ) : (
                          avatar
                        )}
                        <div className="cbody">
                          <div className="citem-head">
                            {authorHref ? (
                              <Link
                                href={authorHref}
                                className="citem-name"
                                onClick={onClose}
                              >
                                {comment.author_name}
                              </Link>
                            ) : (
                              <b className="citem-name">{comment.author_name}</b>
                            )}
                            {comment.user_id === video.author_id && (
                              <span className="citem-badge">{t('comment.author')}</span>
                            )}
                            <time
                              className="citem-time"
                              dateTime={comment.created_at}
                            >
                              {timeAgo(comment.created_at)}
                            </time>
                          </div>
                          <p>{comment.body}</p>
                        </div>
                        {user?.id === comment.user_id && (
                          <DeleteMenu
                            itemLabel="comment"
                            className="citem-menu"
                            onDelete={() => onDeleteComment(comment)}
                          />
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              {user ? (
                <form className="cform" onSubmit={onComment}>
                  <input
                    value={draft}
                    onChange={(event) => onDraftChange(event.target.value)}
                    placeholder={t('comment.placeholder')}
                    maxLength={1000}
                  />
                  <button type="submit" disabled={!draft.trim() || posting} aria-label={t('comment.post')}>
                    <Send aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <div className="cform-guest">
                  <div>
                    <b>{t('comment.joinTitle')}</b>
                    <p>{t('comment.joinLead')}</p>
                  </div>
                  <button type="button" onClick={onNeedAuth}>
                    {t('common.signIn')}
                  </button>
                </div>
              )}
            </aside>
        </div>
      </div>
    </div>
  );
}
