'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Clapperboard, Coins, Home, LogOut, Moon, Plus, Search, Sun, User, Users } from 'lucide-react';
import type { AppUser } from '@/lib/types';
import { getThemeServerSnapshot, getThemeSnapshot, setTheme, subscribeTheme } from '@/lib/theme';
import { avatarStyle, initials, profileHref } from '../media';
import { isNavActive } from './nav-active';
import { useT } from '../i18n-provider';
import LanguageMenu from './LanguageMenu';

interface LeftNavProps {
  user: AppUser | null;
  onCompose: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { href: '/', key: 'nav.home', icon: Home },
  { href: '/search', key: 'nav.search', icon: Search },
  { href: '/following', key: 'nav.following', icon: Users },
  { href: '/bookmarks', key: 'nav.bookmarks', icon: Bookmark },
  { href: '/studio', key: 'nav.studio', icon: Clapperboard },
  { href: '/credits', key: 'nav.credits', icon: Coins },
  { href: '/profile', key: 'nav.profile', icon: User },
] as const;

export default function LeftNav({ user, onCompose, onSignIn, onSignUp, onLogout }: LeftNavProps) {
  const pathname = usePathname();
  const t = useT();
  const isDark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  return (
    <aside className="x-left">
      <div className="x-brand-row">
        <Link className="x-logo" href="/" aria-label={t('nav.home.aria')}>
          <span className="mark" />
          <span>Snackd</span>
        </Link>
        <div className="x-brand-tools">
        <LanguageMenu />
        <button
          type="button"
          className="ghost-btn x-theme"
          onClick={() => setTheme(!isDark)}
          title={isDark ? t('nav.toLight') : t('nav.toDark')}
          aria-label={isDark ? t('nav.toLight') : t('nav.toDark')}
        >
          {isDark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        </button>
        </div>
      </div>

      <nav className="x-nav" aria-label={t('nav.primary')}>
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              <span className="ic"><Icon aria-hidden="true" /></span>
              <span>{t(key)}</span>
            </Link>
          );
        })}
      </nav>

      <button type="button" className="x-post" onClick={onCompose}>
        <span className="ic"><Plus aria-hidden="true" /></span>
        <span>{t('nav.post')}</span>
      </button>

      {user ? (
        <div className="x-account">
          <Link className="x-account-link" href={profileHref(user.handle) || '/profile'} title={t('nav.yourProfile')}>
            <span className="av" style={avatarStyle(user.avatar_color, user.avatar_url)}>
              {initials(user.display_name)}
            </span>
            <span className="txt">
              <b>{user.display_name}</b>
              <small>{user.handle}</small>
            </span>
          </Link>
          <button type="button" className="ghost-btn logout" onClick={onLogout} title={t('common.signOut')} aria-label={t('common.signOut')}>
            <LogOut aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="guest">
          <button type="button" className="signin" onClick={onSignIn}>{t('common.signIn')}</button>
          <button type="button" className="signup" onClick={onSignUp}>{t('common.signUp')}</button>
        </div>
      )}
    </aside>
  );
}
