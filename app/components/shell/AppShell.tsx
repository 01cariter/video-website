'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import type { AppUser, Video } from '@/lib/types';
import type { SuggestedAuthor } from '@/lib/profiles';
import AuthModal from '../AuthModal';
import ComposeModal from '../compose/ComposeModal';
import { OPEN_COMPOSE_EVENT, PUBLISHED_EVENT } from './compose-events';
import LeftNav from './LeftNav';
import RightRail, { type RailTopic } from './RightRail';
import MobileTabBar from './MobileTabBar';

// The right rail owns the search input, but the home timeline (and any other
// page mounted inside the shell) is what actually filters on it — a context
// beats threading `query`/`setQuery` through the route tree by hand.
export interface ShellSearchContextValue {
  query: string;
  setQuery: (value: string) => void;
}

const ShellSearchContext = createContext<ShellSearchContextValue>({
  query: '',
  setQuery: () => {},
});

export function useShellSearch() {
  return useContext(ShellSearchContext);
}

export interface AppShellProps {
  user: AppUser | null;
  suggestions: SuggestedAuthor[];
  hideRightRail?: boolean;
  children: ReactNode;
}

const TOPICS: RailTopic[] = [
  { id: 'study', label: 'Study', href: '/?tab=study' },
  { id: 'play', label: 'Entertainment', href: '/?tab=play' },
];

export default function AppShell({ user, suggestions, hideRightRail = false, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestionList, setSuggestionList] = useState(suggestions);

  // CreatorStudio is the one surface that fills main+right with Worksolo —
  // detected from the route so a segment layout doesn't have to thread a
  // prop through the shared (app) layout.
  const isStudioRoute = pathname?.startsWith('/studio') ?? false;
  const hideRail = hideRightRail || isStudioRoute;

  const requireAuth = useCallback(() => setAuthMode('login'), []);

  const openCompose = useCallback(() => {
    if (!user) return requireAuth();
    setComposeOpen(true);
  }, [requireAuth, user]);

  // Studio's "I have the file" hand-off has no direct reference to this
  // component's state, so it asks for the composer via a window event.
  useEffect(() => {
    window.addEventListener(OPEN_COMPOSE_EVENT, openCompose);
    return () => window.removeEventListener(OPEN_COMPOSE_EVENT, openCompose);
  }, [openCompose]);

  async function logout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  async function follow(authorId: string) {
    if (!user) return requireAuth();
    const target = suggestionList.find((author) => author.user_id === authorId);
    if (!target) return;
    const optimistic = !target.following;
    // Following someone removes them from "Who to follow"; unfollowing restores.
    setSuggestionList((items) =>
      optimistic
        ? items.filter((author) => author.user_id !== authorId)
        : items.map((author) => (author.user_id === authorId ? { ...author, following: false } : author)),
    );
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

  const searchContextValue = useMemo(() => ({ query, setQuery }), [query]);

  return (
    <ShellSearchContext.Provider value={searchContextValue}>
      <div className={`x-app${hideRail ? ' studio' : ''}`}>
        <LeftNav
          user={user}
          onCompose={openCompose}
          onSignIn={() => setAuthMode('login')}
          onSignUp={() => setAuthMode('register')}
          onLogout={() => void logout()}
        />
        <main className="x-main">{children}</main>
        {!hideRail && (
          <RightRail
            query={query}
            onQueryChange={setQuery}
            topics={TOPICS}
            suggestions={suggestionList}
            onFollow={(authorId) => void follow(authorId)}
          />
        )}
      </div>

      <MobileTabBar onCompose={openCompose} />

      <AnimatePresence>
        {authMode && (
          <AuthModal
            mode={authMode}
            nextPath="/"
            onClose={() => setAuthMode(null)}
            onModeChange={setAuthMode}
          />
        )}
      </AnimatePresence>

      {/* Post is upload-only. CreatorStudio (/studio) is the sole surface
          that embeds Worksolo — this modal never renders it. */}
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
    </ShellSearchContext.Provider>
  );
}
