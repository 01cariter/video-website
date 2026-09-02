'use client';

import Link from 'next/link';
import type { ProfileSummary } from '@/lib/types';
import { avatarStyle, fmtLikes, initials, profileHref } from '../media';
import { useT } from '../i18n-provider';

/** One person in a list — profile followers, search results. */
export default function PersonRow({ person }: { person: ProfileSummary }) {
  const t = useT();
  return (
    <Link
      className="pf-person"
      href={profileHref(person.handle) || '#'}
      role="listitem"
    >
      <span
        className="pf-person-av"
        style={avatarStyle(person.avatar_color, person.avatar_url)}
      >
        {initials(person.display_name)}
      </span>
      <span className="pf-person-copy">
        <b>{person.display_name}</b>
        <span>{person.handle || t('common.creator')}</span>
      </span>
      <span className="pf-person-meta">
        <b className="tabular-nums">{fmtLikes(person.posts_count)}</b>
        {person.posts_count === 1 ? 'post' : 'posts'}
      </span>
    </Link>
  );
}
