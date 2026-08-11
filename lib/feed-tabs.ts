import type { VideoCategory } from './types';

export const FEED_TAB_STORAGE_KEY = 'snackd-feed-tabs';
const ALLOWED: VideoCategory[] = ['study', 'play'];
const EMPTY_TABS: VideoCategory[] = [];

export function addCustomTab(tabs: VideoCategory[], category: VideoCategory): VideoCategory[] {
  if (!ALLOWED.includes(category) || tabs.includes(category)) return tabs;
  return [...tabs, category];
}

export function removeCustomTab(tabs: VideoCategory[], category: VideoCategory): VideoCategory[] {
  return tabs.filter((tab) => tab !== category);
}

function parseStoredTabs(): VideoCategory[] {
  try {
    const raw = localStorage.getItem(FEED_TAB_STORAGE_KEY);
    if (!raw) return EMPTY_TABS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY_TABS;
    const tabs = parsed.filter((item): item is VideoCategory => item === 'study' || item === 'play');
    return tabs.length ? tabs : EMPTY_TABS;
  } catch {
    return EMPTY_TABS;
  }
}

export function readCustomTabs(): VideoCategory[] {
  if (typeof window === 'undefined') return EMPTY_TABS;
  return parseStoredTabs();
}

export function writeCustomTabs(tabs: VideoCategory[]) {
  localStorage.setItem(FEED_TAB_STORAGE_KEY, JSON.stringify(tabs));
  invalidateCustomTabsCache();
}

// `useSyncExternalStore` support for reading the localStorage-backed tabs
// during render instead of committing them via `setState` in an effect —
// the latter trips `react-hooks/set-state-in-effect` (a synchronous setState
// in an effect body causes an extra cascading render). The snapshot is
// cached so repeated `getCustomTabsSnapshot()` calls between renders return
// the same array reference; a fresh array on every call would make React
// think the store changed on every render and re-render in a loop.
let cachedSnapshot: VideoCategory[] | null = null;
const listeners = new Set<() => void>();

function invalidateCustomTabsCache() {
  cachedSnapshot = null;
  for (const listener of listeners) listener();
}

export function getCustomTabsSnapshot(): VideoCategory[] {
  if (typeof window === 'undefined') return EMPTY_TABS;
  if (cachedSnapshot === null) cachedSnapshot = parseStoredTabs();
  return cachedSnapshot;
}

// The server has no localStorage, so it always renders the tabless state;
// the client's first snapshot then reconciles without a hydration mismatch.
export function getCustomTabsServerSnapshot(): VideoCategory[] {
  return EMPTY_TABS;
}

export function subscribeCustomTabs(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  listeners.add(onStoreChange);
  // Another tab writing the same key should update this tab's view too.
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key === FEED_TAB_STORAGE_KEY) {
      invalidateCustomTabsCache();
    }
  }
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStorage);
  };
}
