import type { FeedPage, Video } from '@/lib/types';

export function patchCachedVideo<Key>(
  cache: Map<Key, FeedPage>,
  id: number,
  patch: Partial<Video>,
) {
  for (const [key, page] of cache) {
    if (!page.videos.some((video) => video.id === id)) continue;
    cache.set(key, {
      ...page,
      videos: page.videos.map((video) =>
        video.id === id ? { ...video, ...patch } : video,
      ),
    });
  }
}

export function prependCachedVideo<Key>(
  cache: Map<Key, FeedPage>,
  key: Key,
  video: Video,
) {
  const page = cache.get(key);
  if (!page || page.videos.some((item) => item.id === video.id)) return;
  cache.set(key, { ...page, videos: [video, ...page.videos] });
}
