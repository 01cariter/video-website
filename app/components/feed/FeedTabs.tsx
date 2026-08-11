'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { VideoCategory } from '@/lib/types';

export type HomeTabId = 'foryou' | 'following' | VideoCategory;

export const CATEGORY_TAB_LABELS: Record<VideoCategory, string> = {
  study: 'Study',
  play: 'Entertainment',
};

const ALL_CATEGORIES: VideoCategory[] = ['study', 'play'];

export interface FeedTabsProps {
  active: HomeTabId;
  customTabs: VideoCategory[];
  onSelect: (tab: HomeTabId) => void;
  onAddTab: (category: VideoCategory) => void;
  onRemoveTab: (category: VideoCategory) => void;
}

export default function FeedTabs({ active, customTabs, onSelect, onAddTab, onRemoveTab }: FeedTabsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const availableCategories = ALL_CATEGORIES.filter((category) => !customTabs.includes(category));

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  return (
    <nav className="t-tabs" aria-label="Home feed tabs">
      <button
        type="button"
        className={active === 'foryou' ? 't-tab active' : 't-tab'}
        onClick={() => onSelect('foryou')}
        aria-current={active === 'foryou' ? 'page' : undefined}
      >
        For You
      </button>
      <button
        type="button"
        className={active === 'following' ? 't-tab active' : 't-tab'}
        onClick={() => onSelect('following')}
        aria-current={active === 'following' ? 'page' : undefined}
      >
        Following
      </button>

      {customTabs.map((category) => (
        <div className={active === category ? 't-tab custom active' : 't-tab custom'} key={category}>
          <button type="button" onClick={() => onSelect(category)} aria-current={active === category ? 'page' : undefined}>
            {CATEGORY_TAB_LABELS[category]}
          </button>
          <button
            type="button"
            className="t-tab-x"
            onClick={() => onRemoveTab(category)}
            aria-label={`Remove ${CATEGORY_TAB_LABELS[category]} tab`}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ))}

      {availableCategories.length > 0 && (
        <div className="t-tab-add-wrap" ref={menuWrapRef}>
          <button
            type="button"
            className="t-tab-add"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Add a tab"
            aria-expanded={menuOpen}
          >
            <Plus aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="t-tab-menu" role="menu">
              {availableCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onAddTab(category);
                    setMenuOpen(false);
                  }}
                >
                  {CATEGORY_TAB_LABELS[category]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
