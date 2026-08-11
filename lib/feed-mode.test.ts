import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFeedQuery } from './feed-mode';

describe('parseFeedQuery', () => {
  it('defaults to foryou', () => {
    assert.deepEqual(parseFeedQuery({ mode: null, category: null }), {
      mode: 'foryou',
      category: null,
    });
  });
  it('parses category on foryou', () => {
    assert.deepEqual(parseFeedQuery({ mode: 'foryou', category: 'study' }), {
      mode: 'foryou',
      category: 'study',
    });
  });
  it('following clears category', () => {
    assert.deepEqual(parseFeedQuery({ mode: 'following', category: 'play' }), {
      mode: 'following',
      category: null,
    });
  });
});
