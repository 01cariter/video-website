// Client-safe search helpers — `lib/search.ts` is server-only.

export const MAX_SEARCH_QUERY_LENGTH = 80;

/**
 * Collapses whitespace and caps the length. Returns '' for a query with nothing
 * to match on, which every caller treats as "no search".
 */
export function normalizeSearchQuery(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SEARCH_QUERY_LENGTH);
}

/**
 * `%` and `_` are wildcards in LIKE, so a query containing them would match far
 * more than the reader typed. Escape those and the escape character itself; the
 * queries pair this with `ESCAPE '\'`.
 */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export const SEARCH_TABS = [
  { value: 'top', label: 'Top' },
  { value: 'posts', label: 'Posts' },
  { value: 'people', label: 'People' },
] as const;

export type SearchTab = (typeof SEARCH_TABS)[number]['value'];

/** Anything unrecognised falls back to the combined view. */
export function readSearchTab(value: string | undefined | null): SearchTab {
  return SEARCH_TABS.some((tab) => tab.value === value)
    ? (value as SearchTab)
    : 'top';
}

/** `top` is the default, so it stays out of the URL. */
export function searchTabHref(query: string, tab: SearchTab): string {
  const params = new URLSearchParams({ q: query });
  if (tab !== 'top') params.set('t', tab);
  return `/search?${params.toString()}`;
}
