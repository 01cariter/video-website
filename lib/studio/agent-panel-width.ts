export const AGENT_PANEL_WIDTH_STORAGE_KEY = 'snackd-agent-panel-width';
export const AGENT_PANEL_DEFAULT_WIDTH = 360;
export const AGENT_PANEL_MIN_WIDTH = 300;
export const AGENT_PANEL_MAX_WIDTH = 720;

/**
 * The panel is a flex sibling of the canvas, so it can never take so much of
 * the row that the canvas stops being usable. The ceiling tightens on narrow
 * windows for the same reason.
 */
export function clampAgentPanelWidth(width: number, viewportWidth?: number) {
  const ceiling = Math.max(
    AGENT_PANEL_MIN_WIDTH,
    Math.min(
      AGENT_PANEL_MAX_WIDTH,
      viewportWidth ? Math.round(viewportWidth * 0.5) : AGENT_PANEL_MAX_WIDTH,
    ),
  );
  if (!Number.isFinite(width)) return AGENT_PANEL_DEFAULT_WIDTH;
  return Math.round(Math.min(ceiling, Math.max(AGENT_PANEL_MIN_WIDTH, width)));
}

// Same `useSyncExternalStore` shape as the theme store: the width is read from
// storage on the client's first snapshot rather than committed by a setState in
// an effect, so it never costs an extra render or trips
// `react-hooks/set-state-in-effect`.
let cachedSnapshot: number | null = null;
const listeners = new Set<() => void>();

function readStoredWidth(): number {
  try {
    const raw = window.localStorage.getItem(AGENT_PANEL_WIDTH_STORAGE_KEY);
    if (!raw) return AGENT_PANEL_DEFAULT_WIDTH;
    return clampAgentPanelWidth(Number(raw), window.innerWidth);
  } catch {
    // Private windows and blocked site data both throw on access.
    return AGENT_PANEL_DEFAULT_WIDTH;
  }
}

export function setAgentPanelWidth(width: number) {
  const next = clampAgentPanelWidth(width, window.innerWidth);
  if (next === cachedSnapshot) return;
  cachedSnapshot = next;
  try {
    window.localStorage.setItem(AGENT_PANEL_WIDTH_STORAGE_KEY, String(next));
  } catch {
    // A width that cannot be remembered is still a width worth applying.
  }
  for (const listener of listeners) listener();
}

export function getAgentPanelWidthSnapshot(): number {
  if (typeof window === 'undefined') return AGENT_PANEL_DEFAULT_WIDTH;
  if (cachedSnapshot === null) cachedSnapshot = readStoredWidth();
  return cachedSnapshot;
}

export function getAgentPanelWidthServerSnapshot(): number {
  return AGENT_PANEL_DEFAULT_WIDTH;
}

export function subscribeAgentPanelWidth(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}
