'use client';

import Link from 'next/link';
import { ArrowUpRight, FileText, Users } from 'lucide-react';
import type { ProfileSummary } from '@/lib/types';
import { avatarStyle, fmtLikes, initials, profileHref } from '../media';
import { useT } from '../i18n-provider';

export default function FollowingCreators({
  authors,
}: {
  authors: ProfileSummary[];
}) {
  const t = useT();
  return (
    <section className="fg" aria-labelledby="following-creators-title">
      <header className="fg-head">
        <div>
          <span className="fg-kicker">{t('feed.circle')}</span>
          <h1 id="following-creators-title">Following</h1>
        </div>
        <span className="fg-count">
          <Users aria-hidden="true" />
          <span className="tabular-nums">{fmtLikes(authors.length)}</span>
        </span>
      </header>

      {authors.length > 0 ? (
        <div className="fg-grid" role="list">
          {authors.map((author) => {
            const href = profileHref(author.handle) || '/following';
            return (
              <Link className="fg-card" href={href} key={author.user_id} role="listitem">
                <span className="fg-avatar" style={avatarStyle(author.avatar_color, author.avatar_url)}>
                  {initials(author.display_name)}
                </span>
                <span className="fg-copy">
                  <b>{author.display_name}</b>
                  <span>{author.handle || t('common.creator')}</span>
                  <small>
                    <FileText aria-hidden="true" />
                    <span className="tabular-nums">{fmtLikes(author.posts_count)}</span>
                    {author.posts_count === 1 ? ' post' : ' posts'}
                  </small>
                </span>
                <ArrowUpRight className="fg-open" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="fg-empty">
          <Users aria-hidden="true" />
          <div>
            <b>{t('feed.circleEmpty')}</b>
            <p>{t('feed.circleLead')}</p>
          </div>
        </div>
      )}
    </section>
  );
}
