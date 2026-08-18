'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
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
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  function toggleCategory(category: VideoCategory) {
    if (customTabs.includes(category)) onRemoveTab(category);
    else onAddTab(category);
  }

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

      <div className="t-tab-add-wrap">
        <button
          type="button"
          className="t-tab-add"
          onClick={() => setMenuOpen(true)}
          aria-label="Customize tabs"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="t-tab-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                <button
                  type="button"
                  className="t-tab-modal-backdrop"
                  aria-label="Close"
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  className="t-tab-modal-panel"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.25, 0.7, 0.25, 1] }}
                >
                  <header className="t-tab-modal-head">
                    <h2 id={titleId}>Customize tabs</h2>
                    <button
                      type="button"
                      className="t-tab-modal-close"
                      onClick={() => setMenuOpen(false)}
                      aria-label="Close"
                    >
                      <X aria-hidden="true" />
                    </button>
                  </header>
                  <p className="t-tab-modal-lead">Choose which tabs appear on Home.</p>
                  <ul className="t-tab-modal-list">
                    <li>
                      <span>
                        <b>For You</b>
                        <small>Pinned</small>
                      </span>
                      <span className="t-tab-modal-pin">On</span>
                    </li>
                    <li>
                      <span>
                        <b>Following</b>
                        <small>Pinned</small>
                      </span>
                      <span className="t-tab-modal-pin">On</span>
                    </li>
                    {ALL_CATEGORIES.map((category) => {
                      const on = customTabs.includes(category);
                      return (
                        <li key={category}>
                          <span>
                            <b>{CATEGORY_TAB_LABELS[category]}</b>
                            <small>{on ? 'Showing on Home' : 'Hidden'}</small>
                          </span>
                          <button
                            type="button"
                            className={on ? 't-tab-modal-toggle on' : 't-tab-modal-toggle'}
                            aria-pressed={on}
                            onClick={() => toggleCategory(category)}
                          >
                            {on ? 'On' : 'Off'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </nav>
  );
}
