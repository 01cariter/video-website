'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Home, Plus, Search, User, Users } from 'lucide-react';
import { isNavActive } from './nav-active';
import { useT } from '../i18n-provider';

interface MobileTabBarProps {
  onCompose: () => void;
}

// The right rail that carries search on desktop is hidden here, so the tab bar
// takes its place.
const LEADING_TABS = [
  { href: '/', key: 'nav.home', icon: Home },
  { href: '/search', key: 'nav.search', icon: Search },
  { href: '/following', key: 'nav.following', icon: Users },
] as const;

const TRAILING_TABS = [
  { href: '/bookmarks', key: 'nav.bookmarks', icon: Bookmark },
  { href: '/profile', key: 'nav.profile', icon: User },
] as const;

export default function MobileTabBar({ onCompose }: MobileTabBarProps) {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="x-mobile-tabbar" aria-label={t('nav.primary')}>
      {LEADING_TABS.map(({ href, key, icon: Icon }) => (
        <Link key={href} href={href} className={isNavActive(pathname, href) ? 'active' : ''} aria-label={t(key)}>
          <Icon aria-hidden="true" />
        </Link>
      ))}
      <button type="button" className="x-mobile-post" onClick={onCompose} aria-label={t('nav.post')}>
        <Plus aria-hidden="true" />
      </button>
      {TRAILING_TABS.map(({ href, key, icon: Icon }) => (
        <Link key={href} href={href} className={isNavActive(pathname, href) ? 'active' : ''} aria-label={t(key)}>
          <Icon aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}
