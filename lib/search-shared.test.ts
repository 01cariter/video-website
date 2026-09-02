import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_SEARCH_QUERY_LENGTH,
  likePattern,
  normalizeSearchQuery,
  readSearchTab,
  searchTabHref,
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

describe('search result tabs', () => {
  it('falls back to the combined view', () => {
    assert.equal(readSearchTab(undefined), 'top');
    assert.equal(readSearchTab('everything'), 'top');
    assert.equal(readSearchTab('posts'), 'posts');
    assert.equal(readSearchTab('people'), 'people');
  });

  it('keeps the default tab out of the URL and escapes the query', () => {
    assert.equal(searchTabHref('dark mode', 'top'), '/search?q=dark+mode');
    assert.equal(
      searchTabHref('dark mode', 'people'),
      '/search?q=dark+mode&t=people',
    );
    assert.equal(searchTabHref('a&b', 'posts'), '/search?q=a%26b&t=posts');
  });
});
