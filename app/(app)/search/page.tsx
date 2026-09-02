import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { normalizeSearchQuery, searchProfiles, searchVideos } from '@/lib/search';
import PersonRow from '@/app/components/feed/PersonRow';
import SearchBox from '@/app/components/shell/SearchBox';
import SimpleTimeline from '@/app/components/feed/SimpleTimeline';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
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
  const query = normalizeSearchQuery((await searchParams).q);
  const user = await getCurrentUser();
  const [videos, people] = query
    ? await Promise.all([
        searchVideos({ query, viewerId: user?.id ?? null }),
        searchProfiles({ query, viewerId: user?.id ?? null }),
      ])
    : [[], []];
  const nextPath = query
    ? `/search?q=${encodeURIComponent(query)}`
    : '/search';

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
        <p>
          <span className="tabular-nums">{people.length}</span>{' '}
          {people.length === 1 ? 'person' : 'people'} ·{' '}
          <span className="tabular-nums">{videos.length}</span>{' '}
          {videos.length === 1 ? 'post' : 'posts'}
        </p>
        <div className="sr-head-search">
          <SearchBox />
        </div>
      </header>

      {people.length > 0 && (
        <section className="sr-people" aria-label="People">
          <h2>People</h2>
          <div className="pf-people" role="list">
            {people.map((person) => (
              <PersonRow key={person.user_id} person={person} />
            ))}
          </div>
        </section>
      )}

      {people.length > 0 && videos.length > 0 && (
        <h2 className="sr-section-head">Posts</h2>
      )}

      <SimpleTimeline
        key={query}
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
    </section>
  );
}
