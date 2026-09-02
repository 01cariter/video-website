'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// App Router gives no global "navigation started" signal, so the bar starts on
// the click that begins a soft navigation and ends when the rendered route
// (path or query) actually changes.
export const ROUTE_PROGRESS_EVENT = 'snackd:route-start';

export function startRouteProgress() {
  window.dispatchEvent(new Event(ROUTE_PROGRESS_EVENT));
}

function isSoftNavigation(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.('a');
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname + url.search !== window.location.pathname + window.location.search;
}

function RouteProgressBar() {
  const route = `${usePathname()}?${useSearchParams()}`;
  const [renderedRoute, setRenderedRoute] = useState(route);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle');

  // A finished navigation is the only reliable "done" signal, and it is known
  // during render — adjusting here beats an effect that renders twice.
  if (renderedRoute !== route) {
    setRenderedRoute(route);
    if (phase === 'loading') setPhase('done');
  }

  useEffect(() => {
    const start = () => setPhase('loading');
    const onClick = (event: MouseEvent) => {
      if (isSoftNavigation(event)) start();
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener(ROUTE_PROGRESS_EVENT, start);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener(ROUTE_PROGRESS_EVENT, start);
    };
  }, []);

  // Failsafe: a cancelled or same-route navigation must not leave a stuck bar.
  useEffect(() => {
    if (phase === 'idle') return;
    const timer = window.setTimeout(
      () => setPhase(phase === 'loading' ? 'done' : 'idle'),
      phase === 'loading' ? 8000 : 320,
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'idle') return null;
  return (
    <div className="route-progress" role="presentation">
      <i className={phase === 'done' ? 'done' : undefined} />
    </div>
  );
}

export default function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <RouteProgressBar />
    </Suspense>
  );
}
