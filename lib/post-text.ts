import type { Video } from './types';

/** Prefer title; otherwise a short prefix of the body. */
export function postHeadline(video: Video, max = 80): string {
  const title = video.title?.trim();
  if (title) return title;
  const body = video.description?.trim();
  if (!body) return 'Post';
  return body.length > max ? `${body.slice(0, max)}…` : body;
}

export function postSearchText(video: Video): string {
  return [video.title, video.description, video.author_name, video.author_handle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
