export interface SharePayload {
  /** Absolute, public URL of the post. */
  url: string;
  /** One line describing the post — its title, or the start of its body. */
  title: string;
}

export type ShareTargetId =
  | 'x'
  | 'facebook'
  | 'linkedin'
  | 'reddit'
  | 'telegram'
  | 'whatsapp'
  | 'weibo'
  | 'email';

export interface ShareTarget {
  id: ShareTargetId;
  label: string;
  href: (payload: SharePayload) => string;
}

/**
 * Every platform here accepts a link through a documented web intent, so a
 * share is one anchor and no integration. Networks that take an upload instead
 * of a link — YouTube, TikTok, Reels — cannot work this way; the menu offers
 * them the video file instead.
 */
export const SHARE_TARGETS: ShareTarget[] = [
  {
    id: 'x',
    label: 'X',
    href: ({ url, title }) =>
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    href: ({ url }) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: ({ url }) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'reddit',
    label: 'Reddit',
    href: ({ url, title }) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    href: ({ url, title }) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: ({ url, title }) =>
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    id: 'weibo',
    label: 'Weibo',
    href: ({ url, title }) =>
      `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    id: 'email',
    label: 'Email',
    href: ({ url, title }) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`,
  },
];

export const YOUTUBE_UPLOAD_URL = 'https://www.youtube.com/upload';

/** Trims a post's own words down to something a share sheet can carry. */
export function shareTitle(
  input: { title?: string | null; description?: string | null },
  max = 120,
) {
  const text = (input.title?.trim() || input.description?.trim() || '').replace(
    /\s+/g,
    ' ',
  );
  if (!text) return 'A post on Snackd';
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function postShareUrl(origin: string, videoId: number) {
  return `${origin.replace(/\/+$/, '')}/videos/${videoId}`;
}

/** A filename the reader will recognise in their downloads folder. */
export function shareDownloadName(title: string, url: string) {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const safeExtension = /^[a-z0-9]{2,4}$/.test(extension) ? extension : 'mp4';
  const stem =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'snackd-post';
  return `${stem}.${safeExtension}`;
}
