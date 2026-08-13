'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import type { SuggestedAuthor } from '@/lib/profiles';
import { initials, profileHref } from '../media';

export interface RailTopic {
  id: string;
  label: string;
  href: string;
}

interface RightRailProps {
  query: string;
  onQueryChange: (value: string) => void;
  topics: RailTopic[];
  suggestions: SuggestedAuthor[];
  suggestionsLoading?: boolean;
  onFollow: (authorId: string) => void;
}

export default function RightRail({
  query,
  onQueryChange,
  topics,
  suggestions,
  suggestionsLoading = false,
  onFollow,
}: RightRailProps) {
  return (
    <aside className="x-right">
      <label className="x-search">
        <Search aria-hidden="true" />
        <input
          type="search"
          placeholder="Search Snackd"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <div className="x-right-scroll">
        <section className="x-widget">
          <h2>Top topics</h2>
          <ul className="x-topics">
            {topics.map((topic) => (
              <li key={topic.id}>
                <Link href={topic.href}>{topic.label}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="x-widget">
          <h2>Who to follow</h2>
          {suggestionsLoading ? (
            <ul className="x-suggestions x-suggestions-skel" aria-busy="true" aria-label="Loading suggestions">
              {[0, 1, 2].map((item) => (
                <li key={item}>
                  <i className="x-skel-av" />
                  <span className="txt">
                    <i className="x-skel-line" style={{ width: '70%' }} />
                    <i className="x-skel-line" style={{ width: '46%' }} />
                  </span>
                  <i className="x-skel-btn" />
                </li>
              ))}
            </ul>
          ) : suggestions.length === 0 ? (
            <p className="x-widget-empty">No suggestions right now.</p>
          ) : (
            <ul className="x-suggestions">
              {suggestions.map((author) => (
                <li key={author.user_id}>
                  <Link className="x-suggestion-who" href={profileHref(author.handle) || '#'}>
                    <span className="av" style={{ background: author.avatar_color }}>
                      {initials(author.display_name)}
                    </span>
                    <span className="txt">
                      <b>{author.display_name}</b>
                      <small>{author.handle}</small>
                    </span>
                  </Link>
                  <button
                    type="button"
                    className={author.following ? 'followBtn on' : 'followBtn'}
                    onClick={() => onFollow(author.user_id)}
                  >
                    {author.following ? 'Following' : 'Follow'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="x-rail-footer">
          <a href="#">About</a>
          <span aria-hidden="true">·</span>
          <a href="#">Terms</a>
          <span aria-hidden="true">·</span>
          <a href="#">Privacy</a>
          <span aria-hidden="true">·</span>
          <span>© Snackd</span>
        </footer>
      </div>
    </aside>
  );
}
