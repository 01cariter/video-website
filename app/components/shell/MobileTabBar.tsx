'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Home, Plus, User, Users } from 'lucide-react';
import { isNavActive } from './nav-active';

interface MobileTabBarProps {
  onCompose: () => void;
}

const LEADING_TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/following', label: 'Following', icon: Users },
] as const;

const TRAILING_TABS = [
  { href: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { href: '/profile', label: 'Profile', icon: User },
] as const;

export default function MobileTabBar({ onCompose }: MobileTabBarProps) {
  const pathname = usePathname();

  return (
    <nav className="x-mobile-tabbar" aria-label="Primary">
      {LEADING_TABS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={isNavActive(pathname, href) ? 'active' : ''} aria-label={label}>
          <Icon aria-hidden="true" />
        </Link>
      ))}
      <button type="button" className="x-mobile-post" onClick={onCompose} aria-label="Post">
        <Plus aria-hidden="true" />
      </button>
      {TRAILING_TABS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={isNavActive(pathname, href) ? 'active' : ''} aria-label={label}>
          <Icon aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}
