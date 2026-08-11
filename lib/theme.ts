export const THEME_STORAGE_KEY = 'snackd-theme';

function readIsDark(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function setTheme(dark: boolean) {
  const root = document.documentElement;
  if (dark) {
    root.setAttribute('data-theme', 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
  } else {
    root.removeAttribute('data-theme');
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
  }
  invalidateThemeCache();
}

// `useSyncExternalStore` support for reading the `data-theme` attribute the
// root layout's inline script sets pre-paint, instead of committing it via
// `setState` in an effect — the latter trips `react-hooks/set-state-in-effect`
// (a synchronous setState in an effect body causes an extra cascading
// render). The snapshot is cached so repeated `getThemeSnapshot()` calls
// between renders return the same value.
let cachedSnapshot: boolean | null = null;
const listeners = new Set<() => void>();

function invalidateThemeCache() {
  cachedSnapshot = null;
  for (const listener of listeners) listener();
}

export function getThemeSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  if (cachedSnapshot === null) cachedSnapshot = readIsDark();
  return cachedSnapshot;
}

// The server always renders the light-mode markup; the client's first
// snapshot (already applied pre-paint by the layout's inline script) then
// reconciles without a hydration mismatch.
export function getThemeServerSnapshot(): boolean {
  return false;
}

export function subscribeTheme(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}
