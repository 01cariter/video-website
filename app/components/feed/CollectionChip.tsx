import Link from 'next/link';
import { Layers } from 'lucide-react';
import type { Video } from '@/lib/types';
import { useT } from '../i18n-provider';

/**
 * Shown wherever a post appears outside its own detail page — the feed, the
 * preview overlay. It says which collection the post came from and opens it;
 * switching between episodes belongs to the detail page.
 */
export default function CollectionChip({
  video,
  className,
}: {
  video: Video;
  className?: string;
}) {
  if (!video.collection_id || !video.collection_title) return null;
  return (
    <Link
      className={className ? `col-chip ${className}` : 'col-chip'}
      href={`/c/${video.collection_id}`}
      onClick={(event) => event.stopPropagation()}
    >
      <Layers aria-hidden="true" />
      <span>{video.collection_title}</span>
    </Link>
  );
}
