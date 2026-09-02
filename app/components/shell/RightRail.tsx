'use client';

import Link from 'next/link';
import type { SuggestedAuthor } from '@/lib/profiles';
import { avatarStyle, initials, profileHref } from '../media';
import SearchBox from './SearchBox';
import { useT } from '../i18n-provider';

export interface RailTopic {
  id: string;
  label: string;
  href: string;
}

interface RightRailProps {
  topics: RailTopic[];
  suggestions: SuggestedAuthor[];
  suggestionsLoading?: boolean;
  onFollow: (authorId: string) => void;
}

export default function RightRail({
  topics,
  suggestions,
  suggestionsLoading = false,
  onFollow,
}: RightRailProps) {
  const t = useT();
  return (
    <aside className="x-right">
      <SearchBox />

      <div className="x-right-scroll">
        <section className="x-widget">
          <h2>{t('rail.topics')}</h2>
          <ul className="x-topics">
            {topics.map((topic) => (
              <li key={topic.id}>
                <Link href={topic.href}>{topic.label}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="x-widget">
          <h2>{t('rail.whoToFollow')}</h2>
          {suggestionsLoading ? (
            <ul className="x-suggestions x-suggestions-skel" aria-busy="true" aria-label={t('rail.loadingSuggestions')}>
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
            <p className="x-widget-empty">{t('rail.noSuggestions')}</p>
          ) : (
            <ul className="x-suggestions">
              {suggestions.map((author) => (
                <li key={author.user_id}>
                  <Link className="x-suggestion-who" href={profileHref(author.handle) || '#'}>
                    <span className="av" style={avatarStyle(author.avatar_color, author.avatar_url)}>
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
                    {author.following ? t('post.followingState') : t('post.follow')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="x-rail-footer">
          <a href="#">{t('rail.about')}</a>
          <span aria-hidden="true">·</span>
          <a href="#">{t('rail.terms')}</a>
          <span aria-hidden="true">·</span>
          <a href="#">{t('rail.privacy')}</a>
          <span aria-hidden="true">·</span>
          <span>© Snackd</span>
        </footer>
      </div>
    </aside>
  );
}
