import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';
import CreateWorkspace, { type CreateMode } from './CreateWorkspace';

export const dynamic = 'force-dynamic';

const DEFAULT_SOLO_URL = 'https://work-solo.ai/';

interface CreatePageProps {
  searchParams: Promise<{ mode?: string | string[] }>;
}

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/create');

  // Landing on /create asks first. `?mode=upload` / `?mode=solo` skip the ask.
  const params = await searchParams;
  const requested = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const initialMode: CreateMode =
    requested === 'solo' || requested === 'upload' ? requested : 'choose';

  const soloUrl = process.env.NEXT_PUBLIC_SOLO_URL || DEFAULT_SOLO_URL;
  return <CreateWorkspace user={user} soloUrl={soloUrl} initialMode={initialMode} />;
}
