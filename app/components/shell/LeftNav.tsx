'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Clapperboard, Home, LogOut, Moon, Plus, Sun, User, Users } from 'lucide-react';
import type { AppUser } from '@/lib/types';
import { getThemeServerSnapshot, getThemeSnapshot, setTheme, subscribeTheme } from '@/lib/theme';
import { initials, profileHref } from '../media';
import { isNavActive } from './nav-active';

interface LeftNavProps {
  user: AppUser | null;
  onCompose: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/following', label: 'Following', icon: Users },
  { href: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { href: '/studio', label: 'CreatorStudio', icon: Clapperboard },
  { href: '/profile', label: 'Profile', icon: User },
] as const;

export default function LeftNav({ user, onCompose, onSignIn, onSignUp, onLogout }: LeftNavProps) {
  const pathname = usePathname();
  const isDark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  return (
    <aside className="x-left">
      <div className="x-brand-row">
        <Link className="x-logo" href="/" aria-label="Snackd home">
          <span className="mark" />
          <span>Snackd</span>
        </Link>
        <button
          type="button"
          className="ghost-btn x-theme"
          onClick={() => setTheme(!isDark)}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        </button>
      </div>

      <nav className="x-nav" aria-label="Primary">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              <span className="ic"><Icon aria-hidden="true" /></span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <button type="button" className="x-post" onClick={onCompose}>
        <span className="ic"><Plus aria-hidden="true" /></span>
        <span>Post</span>
      </button>

      {user ? (
        <div className="x-account">
          <Link className="x-account-link" href={profileHref(user.handle) || '/profile'} title="Your profile">
            <span className="av" style={{ background: user.avatar_color }}>
              {initials(user.display_name)}
            </span>
            <span className="txt">
              <b>{user.display_name}</b>
              <small>{user.handle}</small>
            </span>
          </Link>
          <button type="button" className="ghost-btn logout" onClick={onLogout} title="Sign out" aria-label="Sign out">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="guest">
          <button type="button" className="signin" onClick={onSignIn}>Sign in</button>
          <button type="button" className="signup" onClick={onSignUp}>Create account</button>
        </div>
      )}
    </aside>
  );
}
