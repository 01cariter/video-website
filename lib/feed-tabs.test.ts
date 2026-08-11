import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addCustomTab, removeCustomTab } from './feed-tabs';

describe('custom feed tabs', () => {
  it('adds a category once', () => {
    assert.deepEqual(addCustomTab([], 'study'), ['study']);
    assert.deepEqual(addCustomTab(['study'], 'study'), ['study']);
  });
  it('removes a category', () => {
    assert.deepEqual(removeCustomTab(['study', 'play'], 'study'), ['play']);
  });
});
