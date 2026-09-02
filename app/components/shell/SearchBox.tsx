'use client';

import { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import {
  MAX_SEARCH_QUERY_LENGTH,
  normalizeSearchQuery,
} from '@/lib/search-shared';

function SearchField() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === '/search' ? (params.get('q') ?? '') : '';
  const [shownActive, setShownActive] = useState(active);
  const [value, setValue] = useState(active);

  // The URL is the source of truth, so a navigation (back button, a link into
  // /search, submitting) resets the field to whatever is being shown.
  if (shownActive !== active) {
    setShownActive(active);
    setValue(active);
  }

  function submit(next: string) {
    const query = normalizeSearchQuery(next);
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  }

  return (
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
        type="search"
        name="q"
        placeholder="Search Snackd"
        aria-label="Search posts and people"
        maxLength={MAX_SEARCH_QUERY_LENGTH}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            setValue('');
          }
        }}
      />
      {value ? (
        <button
          type="button"
          className="x-search-clear"
          aria-label="Clear search"
          onClick={() => {
            setValue('');
            if (active) submit('');
          }}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </form>
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
