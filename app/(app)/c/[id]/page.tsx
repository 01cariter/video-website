import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Layers } from 'lucide-react';
import { getCollection, getCollectionVideos } from '@/lib/collections';
import { getCurrentUser } from '@/lib/user';
import { getTranslate } from '@/lib/i18n/server';
import { profileHref } from '@/app/components/media';
import CollectionEpisodes from '@/app/components/feed/CollectionEpisodes';

export const dynamic = 'force-dynamic';

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

async function readCollection(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return getCollection(id);
}

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const collection = await readCollection((await params).id);
  if (!collection) return {};
  return {
    title: `${collection.title} | Snackd`,
    description:
      collection.description ||
      `${collection.posts_count} posts by ${collection.owner_name}`,
    alternates: { canonical: `/c/${collection.id}` },
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const collection = await readCollection((await params).id);
  if (!collection) notFound();

  const [user, t] = await Promise.all([getCurrentUser(), getTranslate()]);
  const videos = await getCollectionVideos({
    collectionId: collection.id,
    viewerId: user?.id ?? null,
  });
  const owner = profileHref(collection.owner_handle);

  return (
    <section className="t-home">
      <header className="col-head">
        <span className="col-eyebrow">
          <Layers aria-hidden="true" />
          {t('collection.label')}
        </span>
        <h1>{collection.title}</h1>
        {collection.description ? <p>{collection.description}</p> : null}
        <p className="col-meta">
          {owner ? (
            <Link href={owner}>{collection.owner_name}</Link>
          ) : (
            <span>{collection.owner_name}</span>
          )}
          <span aria-hidden="true">·</span>
          {t.plural('collection.episode', collection.posts_count)}
        </p>
      </header>

      <CollectionEpisodes
        collection={collection}
        videos={videos}
        isOwner={user?.id === collection.owner_id}
      />
    </section>
  );
}
