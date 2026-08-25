import assert from 'node:assert/strict';
import test from 'node:test';
import type { FeedPage, Video } from '@/lib/types';
import { patchCachedVideo, prependCachedVideo } from './feed-cache';

const video = (id: number, liked = false) =>
  ({ id, liked, likes_count: liked ? 1 : 0 }) as Video;

test('patches the same post across every cached feed', () => {
  const cache = new Map<string, FeedPage>([
    ['foryou', { videos: [video(1)], nextCursor: 'a' }],
    ['study', { videos: [video(1), video(2)], nextCursor: null }],
  ]);
  patchCachedVideo(cache, 1, { liked: true, likes_count: 1 });
  assert.equal(cache.get('foryou')?.videos[0]?.liked, true);
  assert.equal(cache.get('study')?.videos[0]?.likes_count, 1);
});

test('prepends a publish once without manufacturing an incomplete page', () => {
  const cache = new Map<string, FeedPage>([
    ['foryou', { videos: [video(1)], nextCursor: 'a' }],
  ]);
  prependCachedVideo(cache, 'foryou', video(2));
  prependCachedVideo(cache, 'foryou', video(2));
  prependCachedVideo(cache, 'missing', video(3));
  assert.deepEqual(cache.get('foryou')?.videos.map((item) => item.id), [2, 1]);
  assert.equal(cache.has('missing'), false);
});
