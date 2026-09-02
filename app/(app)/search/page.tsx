import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { normalizeSearchQuery, searchProfiles, searchVideos } from '@/lib/search';
import {
  SEARCH_TABS,
  readSearchTab,
  searchTabHref,
} from '@/lib/search-shared';
import PersonRow from '@/app/components/feed/PersonRow';
import SearchBox from '@/app/components/shell/SearchBox';
import SimpleTimeline from '@/app/components/feed/SimpleTimeline';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  searchParams: Promise<{ q?: string; t?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const query = normalizeSearchQuery((await searchParams).q);
  return {
    title: query ? `${query} — search | Snackd` : 'Search | Snackd',
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolved = await searchParams;
  const query = normalizeSearchQuery(resolved.q);
  const tab = readSearchTab(resolved.t);
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;
  // Each tab only pays for what it shows.
  const [allVideos, allPeople] = query
    ? await Promise.all([
        tab === 'people'
          ? Promise.resolve([])
          : searchVideos({ query, viewerId }),
        tab === 'posts'
          ? Promise.resolve([])
          : searchProfiles({ query, viewerId, limit: tab === 'people' ? 40 : 12 }),
      ])
    : [[], []];
  const people = tab === 'top' ? allPeople.slice(0, 3) : allPeople;
  const videos = allVideos;
  const nextPath = query ? searchTabHref(query, tab) : '/search';

  if (!query) {
    return (
      <section className="t-home">
        <header className="sr-head">
          <h1>Search</h1>
          <p>Find posts and creators across Snackd.</p>
          <div className="sr-head-search">
            <SearchBox />
          </div>
        </header>
        <div className="empty">
          <Search aria-hidden="true" />
          <p>Type a word, a title, or an @handle to get started.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="t-home">
      <header className="sr-head">
        <h1>
          Results for <span>{query}</span>
        </h1>
        <div className="sr-head-search">
          <SearchBox />
        </div>
      </header>

      <nav className="t-tabs sr-tabs" aria-label="Result type">
        {SEARCH_TABS.map((option) => {
          const active = option.value === tab;
          return (
            <Link
              key={option.value}
              href={searchTabHref(query, option.value)}
              className={active ? 't-tab active' : 't-tab'}
              aria-current={active ? 'page' : undefined}
              replace
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      {tab !== 'posts' && people.length > 0 && (
        <section className="sr-people" aria-label="People">
          {tab === 'top' && <h2>People</h2>}
          <div className="pf-people" role="list">
            {people.map((person) => (
              <PersonRow key={person.user_id} person={person} />
            ))}
          </div>
          {tab === 'top' && allPeople.length > people.length && (
            <Link className="sr-more" href={searchTabHref(query, 'people')}>
              See all {allPeople.length} people
            </Link>
          )}
        </section>
      )}

      {tab === 'people' ? (
        people.length === 0 && (
          <div className="empty">
            <Search aria-hidden="true" />
            <p>No people match “{query}”.</p>
          </div>
        )
      ) : (
        <>
          {tab === 'top' && people.length > 0 && videos.length > 0 && (
            <h2 className="sr-section-head">Posts</h2>
          )}
          <SimpleTimeline
            key={`${query}:${tab}`}
            user={user}
            source="search"
            initialVideos={videos}
            nextPath={nextPath}
            emptyLabel={
              people.length > 0
                ? `No posts match “${query}” — only people.`
                : `Nothing matches “${query}” yet.`
            }
          />
        </>
      )}
    </section>
  );
}
