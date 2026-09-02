'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import {
  MAX_SEARCH_QUERY_LENGTH,
  normalizeSearchQuery,
} from '@/lib/search-shared';
import type { SearchSuggestions } from '@/lib/search-types';
import { avatarStyle, fmtLikes, initials, profileHref } from '../media';
import { useT } from '../i18n-provider';

const LIST_ID = 'search-suggestions';
const DEBOUNCE_MS = 180;
const EMPTY: SearchSuggestions = { people: [], posts: [] };

function SearchField() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === '/search' ? (params.get('q') ?? '') : '';
  const [shownActive, setShownActive] = useState(active);
  const [value, setValue] = useState(active);
  const [suggestions, setSuggestions] = useState<SearchSuggestions>(EMPTY);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The URL is the source of truth, so a navigation (back button, a link into
  // /search, submitting) resets the field to whatever is being shown.
  if (shownActive !== active) {
    setShownActive(active);
    setValue(active);
    setOpen(false);
    setActiveIndex(-1);
  }

  const trimmed = normalizeSearchQuery(value);
  // Derived rather than cleared in the effect: with no query there is nothing
  // to suggest, whatever the last response happened to hold.
  const shown = trimmed ? suggestions : EMPTY;

  // One flat list so the arrow keys can walk people, posts, and the "search
  // for" row as a single sequence.
  const options = useMemo(() => {
    if (!trimmed) return [] as Array<{ key: string; href: string | null }>;
    return [
      ...shown.people.map((person) => ({
        key: `person:${person.user_id}`,
        href: profileHref(person.handle),
      })),
      ...shown.posts.map((post) => ({
        key: `post:${post.id}`,
        href: `/videos/${post.id}`,
      })),
      { key: 'all', href: `/search?q=${encodeURIComponent(trimmed)}` },
    ];
  }, [shown, trimmed]);

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPending(true);
      void fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: SearchSuggestions | null) => {
          setSuggestions(data ?? EMPTY);
          setPending(false);
        })
        // Aborted or offline — the "search for" row still gets you there.
        .catch(() => {
          if (!controller.signal.aborted) setPending(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const go = useCallback(
    (href: string | null) => {
      if (!href) return;
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      router.push(href);
    },
    [router],
  );

  const submit = useCallback(
    (next: string) => {
      const query = normalizeSearchQuery(next);
      go(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
    },
    [go],
  );

  const listOpen = open && options.length > 0;
  const activeKey = activeIndex >= 0 ? options[activeIndex]?.key : undefined;

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (listOpen) setOpen(false);
      else if (value) setValue('');
      return;
    }
    if (!listOpen) {
      if (event.key === 'ArrowDown' && options.length) setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + step;
        if (next < 0) return options.length - 1;
        if (next >= options.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      go(options[activeIndex].href);
    }
  }

  function rowProps(key: string, index: number) {
    return {
      id: `${LIST_ID}-${key}`,
      type: 'button' as const,
      role: 'option',
      'aria-selected': key === activeKey,
      className: key === activeKey ? 'x-suggest-row on' : 'x-suggest-row',
      onMouseEnter: () => setActiveIndex(index),
    };
  }

  return (
    <div className="x-search-wrap" ref={rootRef}>
      <form
        className="x-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
      >
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          placeholder={t('search.placeholder')}
          aria-label={t('search.aria')}
          maxLength={MAX_SEARCH_QUERY_LENGTH}
          value={value}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={LIST_ID}
          aria-autocomplete="list"
          aria-activedescendant={activeKey ? `${LIST_ID}-${activeKey}` : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {value ? (
          <button
            type="button"
            className="x-search-clear"
            aria-label={t('search.clear')}
            onClick={() => {
              setValue('');
              setOpen(false);
              if (active) submit('');
            }}
          >
            <X aria-hidden="true" />
          </button>
        ) : null}
      </form>

      {listOpen ? (
        <div
          className="x-suggest"
          id={LIST_ID}
          role="listbox"
          aria-label={t('search.suggestions')}
        >
          {pending && !shown.people.length && !shown.posts.length ? (
            <p className="x-suggest-head" role="status">
              {t('search.searching')}
            </p>
          ) : null}
          {shown.people.length > 0 && (
            <p className="x-suggest-head">{t('search.people')}</p>
          )}
          {shown.people.map((person, offset) => (
            <button
              key={person.user_id}
              {...rowProps(`person:${person.user_id}`, offset)}
              onClick={() => go(profileHref(person.handle))}
            >
              <span
                className="av"
                style={avatarStyle(person.avatar_color, person.avatar_url)}
              >
                {initials(person.display_name)}
              </span>
              <span className="x-suggest-copy">
                <b>{person.display_name}</b>
                <small>{person.handle}</small>
              </span>
              <span className="x-suggest-meta tabular-nums">
                {fmtLikes(person.followers_count)}
              </span>
            </button>
          ))}

          {shown.posts.length > 0 && (
            <p className="x-suggest-head">{t('search.posts')}</p>
          )}
          {shown.posts.map((post, offset) => (
            <button
              key={post.id}
              {...rowProps(
                `post:${post.id}`,
                shown.people.length + offset,
              )}
              onClick={() => go(`/videos/${post.id}`)}
            >
              <span className="x-suggest-icon" aria-hidden="true">
                <Search />
              </span>
              <span className="x-suggest-copy">
                <b>{post.headline}</b>
                <small>
                  {post.author_name}
                  {post.author_handle ? ` · ${post.author_handle}` : ''}
                </small>
              </span>
            </button>
          ))}

          <button
            id={`${LIST_ID}-all`}
            type="button"
            role="option"
            aria-selected={activeKey === 'all'}
            className={activeKey === 'all' ? 'x-suggest-all on' : 'x-suggest-all'}
            onMouseEnter={() => setActiveIndex(options.length - 1)}
            onClick={() => submit(value)}
          >
            <Search aria-hidden="true" />
            {t('search.searchFor', { query: trimmed })}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function SearchBox() {
  return (
    <Suspense
      fallback={
        <div className="x-search" aria-hidden="true">
          <Search />
          <input type="search" placeholder="Search Snackd" disabled />
        </div>
      }
    >
      <SearchField />
    </Suspense>
  );
}
