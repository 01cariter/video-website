'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import type { AppUser, Video } from '@/lib/types';
import type { SuggestedAuthor } from '@/lib/profiles';
import type { MessageKey } from '@/lib/i18n/t';
import { useT } from '../i18n-provider';
import AuthModal from '../AuthModal';
import ComposeModal from '../compose/ComposeModal';
import { OPEN_COMPOSE_EVENT, PUBLISHED_EVENT } from './compose-events';
import { MediaPreviewProvider } from './MediaPreviewContext';
import LeftNav from './LeftNav';
import RightRail from './RightRail';
import MobileTabBar from './MobileTabBar';

export interface AppShellProps {
  user: AppUser | null;
  children: ReactNode;
}

const TOPIC_KEYS = [
  { id: 'study', key: 'common.study', href: '/?tab=study' },
  { id: 'play', key: 'common.play', href: '/?tab=play' },
] as const satisfies ReadonlyArray<{ id: string; key: MessageKey; href: string }>;

export default function AppShell({ user, children }: AppShellProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [suggestionList, setSuggestionList] = useState<SuggestedAuthor[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  const isStudioHome = pathname === '/studio';
  const isWideWorkspace = isStudioHome || pathname === '/credits';
  const requireAuth = useCallback(() => setAuthMode('login'), []);

  const openCompose = useCallback(() => {
    if (!user) return requireAuth();
    setComposeOpen(true);
  }, [requireAuth, user]);

  useEffect(() => {
    window.addEventListener(OPEN_COMPOSE_EVENT, openCompose);
    return () => window.removeEventListener(OPEN_COMPOSE_EVENT, openCompose);
  }, [openCompose]);

  // Suggestions are intentionally client-fetched so the shared layout does
  // not block every soft navigation on a database round-trip.
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/suggestions')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { authors?: SuggestedAuthor[] } | null) => {
        if (cancelled) return;
        setSuggestionList(data?.authors || []);
        setSuggestionsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSuggestionList([]);
        setSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function logout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  async function follow(authorId: string) {
    if (!user) return requireAuth();
    const target = suggestionList.find((author) => author.user_id === authorId);
    if (!target) return;
    setSuggestionList((items) => items.filter((author) => author.user_id !== authorId));
    try {
      const response = await fetch(`/api/authors/${encodeURIComponent(authorId)}/follow`, { method: 'POST' });
      if (response.status === 401) {
        setSuggestionList((items) =>
          items.some((author) => author.user_id === authorId) ? items : [...items, target],
        );
        return requireAuth();
      }
      if (!response.ok) throw new Error('Follow request failed.');
    } catch {
      setSuggestionList((items) =>
        items.some((author) => author.user_id === authorId) ? items : [...items, target],
      );
    }
  }

  return (
    <MediaPreviewProvider user={user} onNeedAuth={requireAuth}>
        <div className={`x-app${isWideWorkspace ? ' wide-workspace' : ''}${isStudioHome ? ' studio-home' : ''}`}>
          <LeftNav
            user={user}
            onCompose={openCompose}
            onSignIn={() => setAuthMode('login')}
            onSignUp={() => setAuthMode('register')}
            onLogout={() => void logout()}
          />
          <main className="x-main">
            {/* Instant route paint — animated remounts caused flash/jump + felt laggy. */}
            <div className="x-main-pane">{children}</div>
          </main>
          {!isWideWorkspace && (
            <RightRail
              topics={TOPIC_KEYS.map((topic) => ({
                id: topic.id,
                label: t(topic.key),
                href: topic.href,
              }))}
              suggestions={suggestionList}
              suggestionsLoading={suggestionsLoading}
              onFollow={(authorId) => void follow(authorId)}
            />
          )}
        </div>

        <MobileTabBar onCompose={openCompose} />

        <AnimatePresence>
          {authMode && (
            <AuthModal
              mode={authMode}
              nextPath={pathname || '/'}
              onClose={() => setAuthMode(null)}
              onModeChange={setAuthMode}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {composeOpen && user && (
            <ComposeModal
              user={user}
              onClose={() => setComposeOpen(false)}
              onPublished={(video: Video) => {
                setComposeOpen(false);
                window.dispatchEvent(new CustomEvent(PUBLISHED_EVENT, { detail: video }));
                router.refresh();
              }}
            />
          )}
        </AnimatePresence>
    </MediaPreviewProvider>
  );
}
