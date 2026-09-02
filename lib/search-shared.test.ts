import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_SEARCH_QUERY_LENGTH,
  likePattern,
  normalizeSearchQuery,
} from './search-shared';

describe('search query normalisation', () => {
  it('collapses whitespace and trims', () => {
    assert.equal(normalizeSearchQuery('  dark   mode  '), 'dark mode');
    assert.equal(normalizeSearchQuery('\n\tstudy\n'), 'study');
  });

  it('treats blank input as no search', () => {
    assert.equal(normalizeSearchQuery(''), '');
    assert.equal(normalizeSearchQuery('   '), '');
    assert.equal(normalizeSearchQuery(null), '');
    assert.equal(normalizeSearchQuery(undefined), '');
  });

  it('caps the length', () => {
    assert.equal(
      normalizeSearchQuery('x'.repeat(500)).length,
      MAX_SEARCH_QUERY_LENGTH,
    );
  });
});

describe('search LIKE patterns', () => {
  it('wraps the term in wildcards', () => {
    assert.equal(likePattern('study'), '%study%');
  });

  // Unescaped, '%' and '_' would make the query match far more than typed.
  it('escapes LIKE wildcards and the escape character', () => {
    assert.equal(likePattern('100%'), '%100\\%%');
    assert.equal(likePattern('a_b'), '%a\\_b%');
    assert.equal(likePattern('back\\slash'), '%back\\\\slash%');
  });
});
